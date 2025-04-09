import cookie from "cookie";

export default function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(process.env.COOKIE_NAME, "", {
      maxAge: 0,
      path: "/",
    })
  );
  res.status(200).json({ message: "Logged out" });
}
