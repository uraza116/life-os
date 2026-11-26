import { Suspense } from "react";
import { ProjectsView } from "@/components/views/projects";

export default function Page() {
  // ProjectsView reads ?new=1 (from the command palette), which needs a Suspense boundary.
  return (
    <Suspense>
      <ProjectsView />
    </Suspense>
  );
}
