import { redirect } from "react-router";

export async function loader() {
  return redirect("/client/dashboard");
}

export default function ClientIndex() {
  return null;
}
