import "@repo/db/env";

import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";

import { auth } from "@repo/auth";

import { getExpressCorsOrigin, serverEnv } from "@api/config/env.js";
import { getHealthStatus } from "@api/modules/health/service.js";
import { createTrpcContext } from "@api/trpc/context.js";
import { appTrpcRouter } from "@api/trpc/router.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: getExpressCorsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appTrpcRouter,
    createContext: createTrpcContext,
  }),
);

app.get("/health", (_request: Request, res: Response) => {
  res.json(getHealthStatus());
});

app.listen(serverEnv.port, serverEnv.listenHost, () => {
  console.log(
    `API listening on http://${serverEnv.listenHost}:${serverEnv.port}`,
  );
});
