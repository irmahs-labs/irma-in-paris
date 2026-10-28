// Every setting the server reads, checked once at startup so a missing value
// stops the deploy instead of the first request.

const required = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set; see .env.example`);
  }

  return value;
};

export const env = {
  // Where the browser loads the site from. Changes are refused from any
  // other origin, so another *.irmahs.dev page cannot post as an admin with
  // the shared sign-in cookie.
  appOrigin: new URL(required("APP_URL")).origin,
  // The account service, as this server reaches it: http://auth:3001 on the
  // server's shared network, http://localhost:3001 locally.
  authUrl: required("AUTH_INTERNAL_URL"),
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 3002),
  // Île-de-France Mobilités' PRIM. Optional: without it the transport
  // screen says live times are off, and everything else still works.
  primApiKey: process.env.PRIM_API_KEY || undefined,
  // Garage, where the photos are: http://garage:3900 on the server's
  // internal network, http://localhost:3900 locally.
  s3: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    bucket: required("S3_BUCKET"),
    endpoint: required("S3_ENDPOINT"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
  // The built site, served beside the API in production. Unset in
  // development, where Vite serves it and forwards /api here.
  staticDir: process.env.STATIC_DIR || undefined,
};
