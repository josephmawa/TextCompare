import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw?version=1";

import { TextCompareWindow } from "./window.js";
import { AboutDialog } from "./about.js";
import { TextComparePreferencesDialog } from "./preferences.js";

export const TextCompareApplication = GObject.registerClass(
  class TextCompareApplication extends Adw.Application {
    constructor() {
      super({
        application_id: pkg.name,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
      });

      const quit_action = new Gio.SimpleAction({ name: "quit" });
      quit_action.connect("activate", (action) => {
        this.quit();
      });
      this.add_action(quit_action);

      const preferencesAction = new Gio.SimpleAction({ name: "preferences" });
      preferencesAction.connect("activate", (action) => {
        const preferencesDialog = new TextComparePreferencesDialog();
        preferencesDialog.present(this.active_window);
      });
      this.add_action(preferencesAction);

      const aboutAction = new Gio.SimpleAction({ name: "about" });
      aboutAction.connect("activate", (action) => {
        const aboutDialog = AboutDialog();
        aboutDialog.present(this.active_window);
      });
      this.add_action(aboutAction);

      /**
       * Be careful when assigning keyboard shortcuts. GtkTextView supports
       * tons of shortcuts out of the box. You might accidentally override
       * some.
       */
      this.set_accels_for_action("app.quit", ["<primary>q"]);
      this.set_accels_for_action("app.preferences", ["<primary>comma"]);
      this.set_accels_for_action("win.compare", ["<shift><primary>c"]);
      this.set_accels_for_action("win.go-back", ["<primary>Left"]);
    }

    vfunc_activate() {
      let activeWindow = this.active_window;
      if (!activeWindow) activeWindow = new TextCompareWindow(this);
      activeWindow.present();
    }
  },
);
