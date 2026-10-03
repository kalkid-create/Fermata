require("dotenv").config();

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");
const { Pool } = require("pg");

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// ============================================
// GTFS ZIP LOCATION
// ============================================

const ZIP_PATH = path.join(
    __dirname,
    "..",
    "..",
    "AddisMapTransit-gtfs-main.zip"
);
// ============================================
// HELPERS
// ============================================

function clean(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}

function readCsvFromZip(zip, filename) {
    const possiblePaths = [
        filename,
        `AddisMapTransit-gtfs-main/${filename}`
    ];

    let entry = null;

    for (const possiblePath of possiblePaths) {
        entry = zip.getEntry(possiblePath);

        if (entry) {
            break;
        }
    }

    if (!entry) {
        throw new Error(`Could not find ${filename} inside GTFS ZIP.`);
    }

    const content = entry.getData().toString("utf8");

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true
    });
}

function routeTypeName(routeType) {
    switch (String(routeType)) {
        case "0":
            return "Tram";

        case "1":
            return "Subway";

        case "2":
            return "Rail";

        case "3":
            return "Bus";

        case "4":
            return "Ferry";

        case "5":
            return "Cable Car";

        case "6":
            return "Gondola";

        case "7":
            return "Funicular";

        default:
            return "Other";
    }
}

// ============================================
// MAIN IMPORT
// ============================================

async function importGtfs() {
    const client = await pool.connect();

    try {
        console.log("");
        console.log("============================================");
        console.log("FERMATA GTFS IMPORT");
        console.log("============================================");
        console.log("");

        // --------------------------------------------
        // Check ZIP
        // --------------------------------------------

        if (!fs.existsSync(ZIP_PATH)) {
            throw new Error(
                `GTFS ZIP not found:\n${ZIP_PATH}`
            );
        }

        console.log("Reading GTFS ZIP...");
        console.log(ZIP_PATH);
        console.log("");

        const zip = new AdmZip(ZIP_PATH);

        // --------------------------------------------
        // Read GTFS files
        // --------------------------------------------

        console.log("Reading stops.txt...");
        const stops = readCsvFromZip(zip, "stops.txt");

        console.log(`Stops loaded: ${stops.length}`);

        console.log("Reading routes.txt...");
        const routes = readCsvFromZip(zip, "routes.txt");

        console.log(`Routes loaded: ${routes.length}`);

        console.log("Reading trips.txt...");
        const trips = readCsvFromZip(zip, "trips.txt");

        console.log(`Trips loaded: ${trips.length}`);

        console.log("Reading stop_times.txt...");
        const stopTimes = readCsvFromZip(zip, "stop_times.txt");

        console.log(`Stop times loaded: ${stopTimes.length}`);

        console.log("Reading shapes.txt...");
        const shapes = readCsvFromZip(zip, "shapes.txt");

        console.log(`Shape points loaded: ${shapes.length}`);

        console.log("");

        // --------------------------------------------
        // Start transaction
        // --------------------------------------------

        await client.query("BEGIN");

        // --------------------------------------------
        // Clean previous imported GTFS data
        // --------------------------------------------

        console.log("Removing previous imported GTFS data...");

        await client.query(`
            DELETE FROM route_stations
            WHERE route_id IN (
                SELECT id
                FROM routes
                WHERE gtfs_route_id IS NOT NULL
            )
        `);

        await client.query(`
            DELETE FROM station_transport_types
            WHERE station_id IN (
                SELECT id
                FROM stations
                WHERE gtfs_stop_id IS NOT NULL
            )
        `);

        await client.query(`
            DELETE FROM routes
            WHERE gtfs_route_id IS NOT NULL
        `);

        await client.query(`
            DELETE FROM stations
            WHERE gtfs_stop_id IS NOT NULL
        `);

        await client.query(`
            DELETE FROM route_shapes
        `);

        // --------------------------------------------
        // TRANSPORT TYPES
        // --------------------------------------------

        console.log("Preparing transport types...");

        const transportTypeIds = {};

        const typeNames = [
            "Bus",
            "Tram",
            "Subway",
            "Rail",
            "Ferry",
            "Cable Car",
            "Gondola",
            "Funicular",
            "Other"
        ];

        for (const typeName of typeNames) {
            const result = await client.query(
                `
                INSERT INTO transport_types (name)
                VALUES ($1)
                ON CONFLICT (name)
                DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                `,
                [typeName]
            );

            transportTypeIds[typeName] = result.rows[0].id;
        }

        // --------------------------------------------
        // IMPORT STATIONS
        // --------------------------------------------

        console.log("");
        console.log("Importing stations...");

        const stationIdMap = new Map();

        let stationCount = 0;

        for (const stop of stops) {

            const stopId = clean(stop.stop_id);
            const stopName = clean(stop.stop_name);

            const latitude = Number(stop.stop_lat);
            const longitude = Number(stop.stop_lon);

            const locationType = clean(stop.location_type);

            // Only import actual stops/platforms.
            // GTFS location_type 0 = stop.
            if (
                locationType &&
                locationType !== "0"
            ) {
                continue;
            }

            if (
                !stopId ||
                !stopName ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {
                continue;
            }

            const result = await client.query(
                `
                INSERT INTO stations (
                    name,
                    description,
                    address,
                    latitude,
                    longitude,
                    gtfs_stop_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
                `,
                [
                    stopName,
                    "Imported from AddisMapTransit GTFS.",
                    stopName,
                    latitude,
                    longitude,
                    stopId
                ]
            );

            stationIdMap.set(
                stopId,
                result.rows[0].id
            );

            stationCount++;
        }

        console.log(
            `Stations imported: ${stationCount}`
        );

        // --------------------------------------------
        // TRIP LOOKUP
        // --------------------------------------------

        const tripMap = new Map();

        for (const trip of trips) {

            const tripId = clean(trip.trip_id);

            if (!tripId) {
                continue;
            }

            tripMap.set(tripId, {
                routeId: clean(trip.route_id),
                shapeId: clean(trip.shape_id),
                directionId: clean(trip.direction_id),
                headsign: clean(trip.trip_headsign)
            });
        }

        // --------------------------------------------
        // STOP SEQUENCES BY ROUTE
        // --------------------------------------------

        const routeStopMap = new Map();

        for (const stopTime of stopTimes) {

            const tripId = clean(stopTime.trip_id);
            const stopId = clean(stopTime.stop_id);

            const trip = tripMap.get(tripId);

            if (!trip) {
                continue;
            }

            if (!stopId) {
                continue;
            }

            const routeId = trip.routeId;

            if (!routeId) {
                continue;
            }

            const sequence = Number(
                stopTime.stop_sequence
            );

            if (!Number.isFinite(sequence)) {
                continue;
            }

            if (!routeStopMap.has(routeId)) {
                routeStopMap.set(routeId, []);
            }

            routeStopMap.get(routeId).push({
                stopId,
                sequence
            });
        }

        // --------------------------------------------
        // IMPORT ROUTES
        // --------------------------------------------

        console.log("");
        console.log("Importing routes...");

        const routeIdMap = new Map();

        let routeCount = 0;

        for (const route of routes) {

            const gtfsRouteId = clean(route.route_id);

            if (!gtfsRouteId) {
                continue;
            }

            const routeName =
                clean(route.route_long_name) ||
                clean(route.route_short_name) ||
                `Route ${gtfsRouteId}`;

            const routeShortName =
                clean(route.route_short_name);

            const routeType =
                Number(route.route_type);

            const typeName =
                routeTypeName(routeType);

            // Find stops for this route
            const routeStops =
                routeStopMap.get(gtfsRouteId) || [];

            const uniqueStops = new Map();

            for (const item of routeStops) {

                if (!uniqueStops.has(item.stopId)) {
                    uniqueStops.set(
                        item.stopId,
                        item.sequence
                    );
                }
            }

            const orderedStops =
                [...uniqueStops.entries()]
                    .sort((a, b) => a[1] - b[1]);

            let origin = routeName;
            let destination = routeName;

            if (orderedStops.length > 0) {

                const firstStopId =
                    orderedStops[0][0];

                const lastStopId =
                    orderedStops[orderedStops.length - 1][0];

                const firstStationId =
                    stationIdMap.get(firstStopId);

                const lastStationId =
                    stationIdMap.get(lastStopId);

                if (firstStationId) {

                    const firstStation =
                        await client.query(
                            `
                            SELECT name
                            FROM stations
                            WHERE id = $1
                            `,
                            [firstStationId]
                        );

                    if (firstStation.rows.length) {
                        origin =
                            firstStation.rows[0].name;
                    }
                }

                if (lastStationId) {

                    const lastStation =
                        await client.query(
                            `
                            SELECT name
                            FROM stations
                            WHERE id = $1
                            `,
                            [lastStationId]
                        );

                    if (lastStation.rows.length) {
                        destination =
                            lastStation.rows[0].name;
                    }
                }
            }

            // Find one shape belonging to this route.
            let shapeId = null;

            for (const trip of trips) {

                if (
                    clean(trip.route_id) ===
                    gtfsRouteId
                ) {
                    shapeId =
                        clean(trip.shape_id);

                    if (shapeId) {
                        break;
                    }
                }
            }

            const result = await client.query(
                `
                INSERT INTO routes (
                    name,
                    origin,
                    destination,
                    transport_type_id,
                    description,
                    gtfs_route_id,
                    route_type,
                    route_short_name,
                    route_color,
                    shape_id
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10
                )
                RETURNING id
                `,
                [
                    routeName,
                    origin,
                    destination,
                    transportTypeIds[typeName],
                    clean(route.route_desc) ||
                        "Imported from AddisMapTransit GTFS.",
                    gtfsRouteId,
                    Number.isFinite(routeType)
                        ? routeType
                        : null,
                    routeShortName || null,
                    clean(route.route_color) || null,
                    shapeId
                ]
            );

            routeIdMap.set(
                gtfsRouteId,
                result.rows[0].id
            );

            routeCount++;
        }

        console.log(
            `Routes imported: ${routeCount}`
        );

        // --------------------------------------------
        // CONNECT ROUTES TO STATIONS
        // --------------------------------------------

        console.log("");
        console.log("Connecting routes to stations...");

        let routeStationCount = 0;

        for (const [
            gtfsRouteId,
            stopList
        ] of routeStopMap.entries()) {

            const routeDbId =
                routeIdMap.get(gtfsRouteId);

            if (!routeDbId) {
                continue;
            }

            const uniqueStops = new Map();

            for (const item of stopList) {

                if (!uniqueStops.has(item.stopId)) {

                    uniqueStops.set(
                        item.stopId,
                        item.sequence
                    );
                }
            }

            const orderedStops =
                [...uniqueStops.entries()]
                    .sort((a, b) => a[1] - b[1]);

            let order = 1;

            for (const [
                gtfsStopId
            ] of orderedStops) {

                const stationDbId =
                    stationIdMap.get(gtfsStopId);

                if (!stationDbId) {
                    continue;
                }

                await client.query(
                    `
                    INSERT INTO route_stations (
                        route_id,
                        station_id,
                        stop_order
                    )
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                    `,
                    [
                        routeDbId,
                        stationDbId,
                        order
                    ]
                );

                routeStationCount++;
                order++;
            }
        }

        console.log(
            `Route-station connections: ${routeStationCount}`
        );

        // --------------------------------------------
        // CONNECT STATIONS TO TRANSPORT TYPES
        // --------------------------------------------

        console.log("");
        console.log("Connecting transport types...");

        for (const route of routes) {

            const gtfsRouteId =
                clean(route.route_id);

            const routeDbId =
                routeIdMap.get(gtfsRouteId);

            if (!routeDbId) {
                continue;
            }

            const routeType =
                Number(route.route_type);

            const typeName =
                routeTypeName(routeType);

            const transportTypeId =
                transportTypeIds[typeName];

            const stopList =
                routeStopMap.get(gtfsRouteId) || [];

            const uniqueStopIds =
                new Set(
                    stopList.map(
                        item => item.stopId
                    )
                );

            for (const gtfsStopId of uniqueStopIds) {

                const stationDbId =
                    stationIdMap.get(gtfsStopId);

                if (!stationDbId) {
                    continue;
                }

                await client.query(
                    `
                    INSERT INTO station_transport_types (
                        station_id,
                        transport_type_id
                    )
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    `,
                    [
                        stationDbId,
                        transportTypeId
                    ]
                );
            }
        }

        // --------------------------------------------
        // IMPORT ROUTE SHAPES
        // --------------------------------------------

        console.log("");
        console.log("Importing route shapes...");

        let shapeCount = 0;

        for (const point of shapes) {

            const shapeId =
                clean(point.shape_id);

            const latitude =
                Number(point.shape_pt_lat);

            const longitude =
                Number(point.shape_pt_lon);

            const sequence =
                Number(point.shape_pt_sequence);

            const distance =
                clean(point.shape_dist_traveled);

            if (
                !shapeId ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                !Number.isFinite(sequence)
            ) {
                continue;
            }

            await client.query(
                `
                INSERT INTO route_shapes (
                    shape_id,
                    latitude,
                    longitude,
                    point_sequence,
                    distance_traveled
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (shape_id, point_sequence)
                DO NOTHING
                `,
                [
                    shapeId,
                    latitude,
                    longitude,
                    sequence,
                    distance
                        ? Number(distance)
                        : null
                ]
            );

            shapeCount++;
        }

        console.log(
            `Shape points imported: ${shapeCount}`
        );

        // --------------------------------------------
        // COMMIT
        // --------------------------------------------

        await client.query("COMMIT");

        console.log("");
        console.log("============================================");
        console.log("IMPORT SUCCESSFUL!");
        console.log("============================================");
        console.log("");
        console.log(`Stations: ${stationCount}`);
        console.log(`Routes: ${routeCount}`);
        console.log(`Route connections: ${routeStationCount}`);
        console.log(`Shape points: ${shapeCount}`);
        console.log("");
        console.log(
            "FERMATA now has GTFS transport data."
        );
        console.log("");

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("");
        console.error("============================================");
        console.error("GTFS IMPORT FAILED");
        console.error("============================================");
        console.error("");
        console.error(error);
        console.error("");

    } finally {

        client.release();
        await pool.end();
    }
}

// ============================================
// RUN
// ============================================

importGtfs();