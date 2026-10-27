import { createServer } from "node:http";

import { reply } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  const { body, status } = reply(
    new URL(req.url ?? "/", "http://app").pathname
  );

  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}).listen(port, () => {
  console.log(`listening on :${port}`);
});
