// What the placeholder server answers. Replace it with the real app, keeping
// the scripts in package.json (check, typecheck, test, build, start) that CI
// and the Dockerfile run.
export interface Reply {
  body: string;
  status: number;
}

export const reply = (path: string): Reply => {
  if (path === "/healthz") {
    return { body: "ok", status: 200 };
  }

  if (path === "/") {
    return { body: "Hello from a new irmahs-labs app", status: 200 };
  }

  return { body: "Not found", status: 404 };
};
