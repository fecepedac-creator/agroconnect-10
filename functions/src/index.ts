import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export const hello = onRequest((req, res) => {
  logger.info("AgroConnect Functions OK", { path: req.path });
  res.status(200).send("Functions OK ✅");
});
