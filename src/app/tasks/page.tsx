import { Suspense } from "react";
import { AllTasksView } from "@/components/views/lists";

export default function Page() {
  // AllTasksView reads ?view=<saved view id>, which needs a Suspense boundary under cacheComponents.
  return (
    <Suspense>
      <AllTasksView />
    </Suspense>
  );
}
