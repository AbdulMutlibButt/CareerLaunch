export const isVercelRuntime = (values = process.env) => values.VERCEL === "1";

export function startLocalServer(
  app,
  store,
  config,
  {
    values = process.env,
    processRef = process,
    log = (message) => console.log(message),
  } = {},
) {
  if (isVercelRuntime(values)) return null;
  const server = app.listen(config.port, config.host, () =>
    log(
      `CareerLaunch API listening on ${config.host}:${config.port} (${store.mode})`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    processRef.on(signal, () =>
      server.close(async () => {
        await store.close();
        processRef.exit(0);
      }),
    );
  return server;
}
