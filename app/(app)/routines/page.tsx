import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getRoutines } from "@/lib/routines";
import { RoutinesView } from "./routines-view";

export default async function RoutinesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const routines = await getRoutines(session.user.id);
  return <RoutinesView initialRoutines={routines} />;
}
