import cookie from "cookie";

export function verifyToken(req) {
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  return cookies[process.env.COOKIE_NAME] === process.env.SHARED_TOKEN;
}