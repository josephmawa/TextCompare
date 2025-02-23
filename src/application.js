import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

import { CompareWindow } from "./window.js";

export const CompareApplication = GObject.registerClass(
  class CompareApplication extends Adw.Application {
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
      this.set_accels_for_action("app.quit", ["<primary>q"]);

      const show_about_action = new Gio.SimpleAction({ name: "about" });
      show_about_action.connect("activate", (action) => {
        let aboutParams = {
          application_name: APP_NAME,
          application_icon: pkg.name,
          developer_name: "Joseph Mawa",
          version: pkg.version,
          developers: ["Joseph Mawa"],
          // Translators: Replace "translator-credits" with your name/username, and optionally an email or URL.
          translator_credits: _("translator-credits"),
          copyright: "Copyright © 2025 Joseph Mawa",
        };
        const aboutDialog = new Adw.AboutDialog(aboutParams);
        aboutDialog.present(this.active_window);
      });
      this.add_action(show_about_action);
    }

    vfunc_activate() {
      let { active_window } = this;

      if (!active_window) active_window = new CompareWindow(this);

      active_window.present();
    }
  }
);
