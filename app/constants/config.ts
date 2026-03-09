// BASE_URL is read from the EXPO_PUBLIC_API_URL environment variable at build
// time. EXPO_PUBLIC_* variables are embedded by Expo's bundler — they are NOT
// secret and will be visible in the compiled app bundle.
//
// For local development, create a file called .env.local in the /app directory:
//   EXPO_PUBLIC_API_URL=http://192.168.x.x:8080
// Replace 192.168.x.x with your machine's LAN IP address (find it with
// `ipconfig getifaddr en0` on macOS). The Go server must be running on that
// machine with CORS enabled.
//
// For production (Fly.io), set:
//   EXPO_PUBLIC_API_URL=https://your-app.fly.dev
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export { BASE_URL };
