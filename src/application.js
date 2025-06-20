import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw?version=1";

import { TextCompareWindow } from "./window.js";
import { AboutDialog } from "./about.js";
import { TextComparePreferencesDialog } from "./preferences.js";

export const settings = Gio.Settings.new(pkg.name);

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
       * some if you're not careful.
       */
      this.set_accels_for_action("app.quit", ["<primary>q"]);
      this.set_accels_for_action("app.preferences", ["<primary>comma"]);
      this.set_accels_for_action("win.compare", ["<shift><primary>c"]);
      this.set_accels_for_action("win.go-back", ["<primary>Left"]);

      /**
       * This will create an action for changing color schemes. We create
       * an action and connect the handler here but do not invoke the signal
       * handler, this.setColorScheme, to set preferred color scheme at startup.
       * This is  because this.setColorScheme retrieves the default style manager.
       * We can only retrieve the default style manager after Gtk.init. Therefore,
       * this.setColorScheme is invoked in vfunc_activate. 
       */
      this.add_action(settings.create_action("color-scheme"));
      settings.connect("changed::color-scheme", this.setColorScheme);
    }

    setColorScheme = () => {
      const styleManager = Adw.StyleManager.get_default();
      styleManager.set_color_scheme(settings.get_int("color-scheme"));
    };

    vfunc_activate() {
      let { active_window } = this;
      if (!active_window) {
        active_window = new TextCompareWindow(this);
        /** 
         * Set preferred color scheme after invoking Gtk.init.
         * */
        this.setColorScheme();
      }
      active_window.present();
    }
  }
);
