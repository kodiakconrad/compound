import { Redirect } from "expo-router";

// `(tabs)` is a route group — its parentheses mean it doesn't appear in the
// URL, so none of its screens live at the bare "/" path. On a cold start
// (no deep link), expo-router needs an explicit match for "/" or it falls
// through to the "Unmatched Route" screen. This redirects "/" to the Today
// tab, which is the app's default landing screen.
export default function Index() {
  return <Redirect href="/today" />;
}
