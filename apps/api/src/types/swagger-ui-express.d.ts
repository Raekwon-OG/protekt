// Minimal ambient module declaration for `swagger-ui-express`.
// This prevents TypeScript errors in projects that don't have official type
// definitions. It's intentionally permissive — if you want stronger typing,
// replace `any` with precise interfaces.
declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';

  const serve: RequestHandler[];

  function setup(
    swaggerDoc: any,
    options?: any,
    req?: any,
    res?: any,
    next?: any
  ): RequestHandler;

  export { serve, setup };
  export default { serve, setup } as {
    serve: RequestHandler[];
    setup: typeof setup;
  };
}
