import { redirect } from "react-router";

export function loader() {
  return redirect("/client/dashboard");
}

export default function Index() {
  return null;
}
