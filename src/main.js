import { TextCompareApplication } from "./application.js";

export function main(argv) {
  const application = new TextCompareApplication();
  return application.runAsync(argv);
}
