"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ProjectDetailView } from "@/components/views/projects";

function Detail() {
  const { id } = useParams<{ id: string }>();
  return <ProjectDetailView id={id} />;
}

export default function Page() {
  // Project ids are only known at request time, so param access sits inside Suspense.
  return (
    <Suspense>
      <Detail />
    </Suspense>
  );
}
