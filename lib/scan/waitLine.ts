// What people see while their room builds. The pipeline's own status messages
// are backstage (they name Claude and steps people never see), so map them to
// a few plain lines.
export function waitLine(stage: string, message = ""): string {
  if (stage === "uploaded") return "Getting started";
  if (stage === "reading") return "Reading your photos";
  if (stage === "rendering" || /saving/i.test(message)) return "Finishing up";
  if (/furniture/i.test(message)) return "Modeling your furniture";
  if (stage === "building") return "Building walls, floor, doors and windows";
  return "Almost ready";
}
