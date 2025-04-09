import cookie from "cookie";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token } = req.body;
  if (token === process.env.SHARED_TOKEN) {
    res.setHeader(
      "Set-Cookie",
      cookie.serialize(process.env.COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 1 day
        path: "/",
      })
    );
    return res.status(200).json({ message: "Login successful" });
  }

  return res.status(401).json({ message: "Invalid token" });
}
