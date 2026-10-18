#!/usr/bin/env python3
"""Build region-scoped, *verifiable* GTFS indexes from the same BusOne static feeds
as the app's GTFS-Realtime feeds. Python stdlib; no credentials or NPM required.

Does NOT infer bus lines from vehicle/fleet IDs or invent train equipment.
"""
from __future__ import annotations
import argparse
import csv
from datetime import datetime, timedelta
import io
import json
from pathlib import Path
import tempfile
import urllib.request
from zoneinfo import ZoneInfo
import zipfile
import math

URLS = {region: f'https://proxy.busone.app/{namespace}/gtfs.zip'
        for region, namespace in [('sta','sta'),('trentino','trentino'),('trains','trenitalia')]}
BBOX = (45.25, 47.35, 9.85, 12.95)
PROJECT = Path(__file__).resolve().parent.parent


def csv_rows(zf, name):
    names = {name.lower(): name for name in zf.namelist()}
    actual = next((original for short, original in names.items() if short.endswith('/'+name) or short == name), None)
    if not actual:
        return
    with zf.open(actual) as raw:
        stream = io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')
        yield from csv.DictReader(stream)


def active_services(zf, days):
    # Calendar exceptions apply to a *specific day*, not to every day in a window.
    # Build each day separately and take their union, preserving overnight services.
    calendar=list(csv_rows(zf,'calendar.txt'))
    exceptions=list(csv_rows(zf,'calendar_dates.txt'))
    if not calendar and not exceptions:
        return None
    week=['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    union=set()
    for date in days:
        compact=date.strftime('%Y%m%d')
        active={row['service_id'] for row in calendar
                if row.get('start_date','')<=compact<=row.get('end_date','')
                and row.get(week[date.weekday()])=='1'}
        for row in exceptions:
            if row.get('date')!=compact:continue
            if row.get('exception_type')=='1':active.add(row['service_id'])
            elif row.get('exception_type')=='2':active.discard(row['service_id'])
        union.update(active)
    return union


def inside(lat,lon,margin=0):
    return BBOX[0]-margin <= lat <= BBOX[1]+margin and BBOX[2]-margin <= lon <= BBOX[3]+margin


def seconds(clock):
    try:
        h,m,s=(int(p) for p in clock.split(':'))
        return h*3600+m*60+s
    except (ValueError,AttributeError): return None


def simplify_points(points, tolerance=0.00018):
    """Fast Douglas-Peucker, approximate ~20m latitude tolerance, preserve endpoints."""
    if len(points)<3:return points
    keep={0,len(points)-1}; stack=[(0,len(points)-1)]
    while stack:
        start,end=stack.pop(); a,b=points[start],points[end]
        mid=(a[0]+b[0])*0.5; cos=math.cos(math.radians(mid))
        dx=(b[1]-a[1])*cos;dy=b[0]-a[0]; denominator=dx*dx+dy*dy
        maximum=-1; best=None
        for i in range(start+1,end):
            p=points[i];px=(p[1]-a[1])*cos;py=p[0]-a[0]
            t=max(0,min(1,(px*dx+py*dy)/denominator)) if denominator>0 else 0
            d=math.hypot(px-dx*t,py-dy*t)
            if d>maximum:maximum=d;best=i
        if maximum>tolerance and best is not None:
            keep.add(best);stack.extend([(start,best),(best,end)])
    return [points[i] for i in sorted(keep)]


def atomic_json(filename, data):
    dest=PROJECT/'public'/'data'/filename
    dest.parent.mkdir(parents=True,exist_ok=True)
    body=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    if len(body.encode('utf-8'))>23_000_000:
        raise ValueError(f'{dest.name}: GTFS asset too large; needs region sharding')
    dest.write_text(body+'\n',encoding='utf-8')
    print(f'  {dest.name}: {len(body):,} chars')


def write_bus_shapes(region, meta, shapes):
    """Shard only verified GTFS bus polylines; the app fetches the shards it needs.

    Keeps each static Cloudflare asset safely below the existing 23 MB cap.
    No inferred routes or straight lines between stops are generated.
    """
    target=PROJECT/'public'/'data'
    for stale in target.glob(f'{region}-bus-[0-9][0-9]*-shapes.json'):
        stale.unlink()
    parts=[]; mapping={}; bounds={}; batch={}; byte_count=0
    max_bytes=7_000_000
    def flush():
        nonlocal batch,byte_count
        if not batch:return
        filename=f'{region}-bus-{len(parts):02d}-shapes.json'
        atomic_json(filename,{'shapes':batch})
        parts.append(filename)
        for key in batch:mapping[key]=filename
        batch={};byte_count=0
    for shape_id,points in sorted(shapes.items()):
        estimated=len(json.dumps(shape_id,ensure_ascii=False).encode('utf-8'))+len(json.dumps(points,separators=(',',':')).encode('utf-8'))+5
        if estimated>max_bytes:continue
        if batch and byte_count+estimated>max_bytes:flush()
        batch[shape_id]=points
        bounds[shape_id]=[round(min(pt[0] for pt in points),5),round(min(pt[1] for pt in points),5),round(max(pt[0] for pt in points),5),round(max(pt[1] for pt in points),5)]
        byte_count+=estimated
    flush()
    atomic_json(f'{region}-bus-index.json',{'meta':dict(meta,busShapeCount=len(shapes)),'byShape':mapping,'bounds':bounds,'files':parts})


def compile_source(region, source_zip, days):
    with zipfile.ZipFile(source_zip) as zf:
        names={Path(n).name.lower() for n in zf.namelist()}
        required={'routes.txt','trips.txt','stops.txt','stop_times.txt'}
        if required - names:raise ValueError(f'Missing GTFS files: {required-names}')
        services=active_services(zf,days)
        today_services=active_services(zf,[days[1]])
        services_per_day={d.isoformat():active_services(zf,[d]) for d in days}
        stops={}; nearby=set()
        for row in csv_rows(zf,'stops.txt'):
            sid=row.get('stop_id'); name=row.get('stop_name','')
            if not sid:continue
            try:lat=float(row['stop_lat']);lon=float(row['stop_lon'])
            except (ValueError,KeyError):lat=0;lon=0
            stops[sid]=[name,round(lat,5),round(lon,5),row.get('platform_code','').strip(),row.get('parent_station','')]
            if inside(lat,lon):nearby.add(sid)
        # Nationwide Trenitalia GTFS is filtered by all trips that stop in our geographic area.
        localTrips=None
        if region=='trains':
            localTrips=set()
            for row in csv_rows(zf,'stop_times.txt'):
                if row.get('stop_id') in nearby:localTrips.add(row.get('trip_id'))
        routes={};allRoutes={}
        for row in csv_rows(zf,'routes.txt'):
            rid=row.get('route_id')
            if rid:allRoutes[rid]=[row.get('route_short_name',''),row.get('route_long_name',''),row.get('route_type','')]
        trips={}; shapesUsed=set()
        for row in csv_rows(zf,'trips.txt'):
            tid=row.get('trip_id'); sid=row.get('service_id')
            if not tid or (services is not None and sid not in services):continue
            if localTrips is not None and tid not in localTrips:continue
            route=row.get('route_id',''); shape=row.get('shape_id','')
            trips[tid]=[route,row.get('trip_headsign',''),shape,row.get('trip_short_name',''),sid,
                        today_services is None or sid in today_services, row.get('direction_id','')]
            if shape:shapesUsed.add(shape)
            if route in allRoutes:routes[route]=allRoutes[route]
        times={};usedStops=set()
        for row in csv_rows(zf,'stop_times.txt'):
            tid=row.get('trip_id')
            if tid not in trips:continue
            stop=row.get('stop_id')
            if not stop:continue
            try:seq=int(row.get('stop_sequence') or 0)
            except ValueError:seq=0
            times.setdefault(tid,[]).append([stop,seconds(row.get('arrival_time','')),seconds(row.get('departure_time','')),seq])
            usedStops.add(stop)
        for tid,rows in times.items():rows.sort(key=lambda item:item[3])
        # Train paths for national AND local rail services; never snap buses to tracks.
        rail_shapes={trip[2] for trip in trips.values() if trip[2] and
                     (region=='trains' or str(allRoutes.get(trip[0],['','',''])[2]) in ('1','2') or
                      (str(allRoutes.get(trip[0],['','',''])[2]).isdigit() and
                       (100 <= int(allRoutes[trip[0]][2]) < 200 or 300 <= int(allRoutes[trip[0]][2]) < 700)))}
        bus_shapes=shapesUsed-rail_shapes if region!='trains' else set()
        wanted_shapes=rail_shapes|bus_shapes
        shapes={}; bus_geometries={}
        if wanted_shapes and 'shapes.txt' in names:
            rawShape={}
            for row in csv_rows(zf,'shapes.txt'):
                sid=row.get('shape_id')
                if sid not in wanted_shapes:continue
                try:
                    lat=float(row['shape_pt_lat']);lon=float(row['shape_pt_lon']);seq=int(row.get('shape_pt_sequence') or 0)
                except (ValueError,KeyError):continue
                rawShape.setdefault(sid,[]).append((seq,lat,lon))
            for sid,points in rawShape.items():
                pts=[(lat,lon) for _,lat,lon in sorted(points)]
                # Keep boundary-adjacent points to support smooth snapping at map edges.
                filtered=[pts[i] for i in range(len(pts)) if inside(*pts[i],margin=.18) or
                          (i>0 and inside(*pts[i-1],margin=.18)) or
                          (i<len(pts)-1 and inside(*pts[i+1],margin=.18))]
                if len(filtered)>=2:
                    shape=simplify_points(filtered,tolerance=.00013 if sid in bus_shapes else .00018)
                    compact=[[round(lat,5),round(lon,5)] for lat,lon in shape]
                    if sid in rail_shapes:shapes[sid]=compact
                    else:bus_geometries[sid]=compact
        # Only include stops actually referenced by the in-scope trips.
        compactStops={sid:stops[sid] for sid in usedStops if sid in stops}
        meta={'ready':True,'source':URLS[region], 'builtAt':datetime.now(ZoneInfo('Europe/Rome')).isoformat(),
              'days':[d.isoformat() for d in days], 'tripCount':len(trips),'routeCount':len(routes)}
        # Only a single *official* shape for the same direction and GTFS service
        # day may be used as a route-level hint, not an exact trip identification.
        unique_bus_shapes_by_day={}
        bus_shape_candidates_by_day={}
        if region!='trains':
            for service_day, valid_services in services_per_day.items():
                # Unknown service calendars -> do not make strong claims.
                if valid_services is None:continue
                options={}
                for trip in trips.values():
                    route, _, shape, _, service_id, _, direction=trip
                    if service_id not in valid_services or not shape or shape not in bus_geometries or direction not in ('0','1'):
                        continue
                    if route not in routes or routes[route][2] in ('1','2'):
                        continue
                    options.setdefault((route,direction),set()).add(shape)
                mapping={}
                candidates={}
                for (route,direction),variants in options.items():
                    # Do not truncate large ambiguous route groups; exclude them instead.
                    if 1 <= len(variants) <= 32:
                        candidates.setdefault(route,{})[direction]=sorted(variants)
                    if len(variants)==1:
                        mapping.setdefault(route,{})[direction]=next(iter(variants))
                unique_bus_shapes_by_day[service_day]=mapping
                bus_shape_candidates_by_day[service_day]=candidates
        unique_bus_shapes=unique_bus_shapes_by_day.get(days[1].isoformat(),{})
        atomic_json(f'{region}-index.json',{'meta':meta,'routes':routes,'trips':trips,
                                           'uniqueBusShapes':unique_bus_shapes,
                                           'uniqueBusShapesByDay':unique_bus_shapes_by_day,
                                           'busShapeCandidatesByDay':bus_shape_candidates_by_day})
        atomic_json(f'{region}-details.json',{'meta':meta,'stops':compactStops,'times':times})
        atomic_json(f'{region}-shapes.json',{'meta':meta,'shapes':shapes})
        if region!='trains':write_bus_shapes(region,meta,bus_geometries)
        print(f'{region}: {len(trips)} trips, {len(compactStops)} stops, {len(shapes)} rail shapes, {len(bus_geometries)} bus shapes')


def download(name, directory):
    request=urllib.request.Request(URLS[name],headers={
        'User-Agent':'SuedtirolRadar/3.0 (+https://github.com/hmtckphng2-gif/Radar-S)',
        'X-BusOne-Client':'Suedtirol Radar / personal project; https://github.com/hmtckphng2-gif/Radar-S',
        'X-BusOne-Use':'personal'
    })
    dest=Path(directory)/(name+'.zip');size=0
    with urllib.request.urlopen(request,timeout=100) as res,dest.open('wb') as target:
        while block:=res.read(1024*1024):
            size+=len(block)
            if size>200_000_000:raise ValueError('GTFS ZIP exceeded 200MB download limit')
            target.write(block)
    return dest


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--sources',nargs='+',choices=URLS,default=list(URLS))
    ap.add_argument('--fixture-root',type=Path,help='Local folder containing sta.zip, trentino.zip, trains.zip; for tests')
    ap.add_argument('--date',help='YYYY-MM-DD (Europe/Rome); default today')
    args=ap.parse_args()
    today=datetime.strptime(args.date,'%Y-%m-%d').date() if args.date else datetime.now(ZoneInfo('Europe/Rome')).date()
    days=[today-timedelta(days=1),today,today+timedelta(days=1)]
    with tempfile.TemporaryDirectory() as tmp:
        successful=0
        for region in args.sources:
            try:
                local=(args.fixture_root/(region+'.zip')) if args.fixture_root else download(region,tmp)
                compile_source(region,local,days)
                successful+=1
            except Exception as exc:
                print(f'WARNING: {region} unavailable, keeping old index: {exc}',flush=True)
                if args.fixture_root: raise
        if not successful:
            raise RuntimeError('No GTFS region updated; existing datasets left unchanged')

if __name__=='__main__':main()
