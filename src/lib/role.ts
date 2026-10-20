import { cookies } from "next/headers";

export type Role = "reviewer" | "submitter";

const ROLE_COOKIE = "clearpath-role";
const NAME_COOKIE = "clearpath-name";

export async function getRole(): Promise<Role> {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  return role === "submitter" ? "submitter" : "reviewer";
}

export async function getActorName(): Promise<string> {
  const cookieStore = await cookies();
  const name = cookieStore.get(NAME_COOKIE)?.value;
  if (name) return name;
  const role = await getRole();
  return role === "reviewer" ? "Reviewer" : "Submitter";
}
