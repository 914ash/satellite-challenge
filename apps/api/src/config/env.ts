import { config } from "dotenv";
import { z } from "zod";

config({ path: "../../.env" });
config();

const DEFAULT_MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const DEFAULT_MAP_CENTER: [number, number] = [45, 24];
const DEFAULT_MAP_ZOOM = 4;
const DEFAULT_SATELLITE_MODE_DEFAULT = true;

const mapCenterSchema = z
  .string()
  .transform((value) => value.split(",").map((part) => Number(part.trim())))
  .pipe(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .default(DEFAULT_MAP_CENTER.join(","))
  .catch(DEFAULT_MAP_CENTER);

const mapSatelliteModeSchema = z
  .preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
    return value;
  }, z.boolean())
  .default(DEFAULT_SATELLITE_MODE_DEFAULT)
  .catch(DEFAULT_SATELLITE_MODE_DEFAULT);

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  MAP_STYLE: z.string().trim().min(1).default(DEFAULT_MAP_STYLE).catch(DEFAULT_MAP_STYLE),
  MAP_DEFAULT_CENTER: mapCenterSchema,
  MAP_DEFAULT_ZOOM: z.coerce.number().min(0).max(22).default(DEFAULT_MAP_ZOOM).catch(DEFAULT_MAP_ZOOM),
  MAP_SATELLITE_MODE_DEFAULT: mapSatelliteModeSchema,
  AISSTREAM_API_KEY: z.string().optional(),
  FLIGHTAWARE_API_KEY: z.string().optional(),
  OPENSKY_USERNAME: z.string().optional(),
  OPENSKY_PASSWORD: z.string().optional(),
  REPLAY_RETENTION_MS: z.coerce.number().default(60 * 60 * 1000),
  OPENSKY_POLL_INTERVAL_MS: z.coerce.number().default(15_000),
  FLIGHTAWARE_TTL_MS: z.coerce.number().default(10 * 60 * 1000)
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);
