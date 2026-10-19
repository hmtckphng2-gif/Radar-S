-- Radar History Engine v1; no passenger identifiers, no IP addresses.
CREATE TABLE IF NOT EXISTS vehicle_observations (
 source TEXT NOT NULL, vehicle_key TEXT NOT NULL, observed_at INTEGER NOT NULL,
 collected_at INTEGER NOT NULL, kind TEXT NOT NULL, route_id TEXT, trip_id TEXT,
 trip_start_date TEXT, vehicle_id TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL,
 quality TEXT, position_type TEXT,
 PRIMARY KEY(source,vehicle_key,observed_at)
);
CREATE INDEX IF NOT EXISTS idx_observation_trip ON vehicle_observations(trip_id,observed_at);
CREATE INDEX IF NOT EXISTS idx_observation_vehicle ON vehicle_observations(vehicle_key,observed_at);
CREATE TABLE IF NOT EXISTS stop_delay_events (
 source TEXT NOT NULL, trip_id TEXT NOT NULL, trip_start_date TEXT NOT NULL,
 stop_id TEXT NOT NULL, stop_sequence INTEGER NOT NULL, event_type TEXT NOT NULL,
 feed_observed_at INTEGER NOT NULL, collected_at INTEGER NOT NULL,
 delay_seconds INTEGER, scheduled_at INTEGER, predicted_at INTEGER,
 PRIMARY KEY(source,trip_id,trip_start_date,stop_id,stop_sequence,event_type,feed_observed_at)
);
CREATE INDEX IF NOT EXISTS idx_stop_delay_history ON stop_delay_events(stop_id,collected_at);
CREATE INDEX IF NOT EXISTS idx_stop_delay_trip ON stop_delay_events(trip_id,trip_start_date,stop_sequence);
