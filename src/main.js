import { CompareApplication } from "./application.js";

export function main(argv) {
  const application = new CompareApplication();
  return application.runAsync(argv);
}
