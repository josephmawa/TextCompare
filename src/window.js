import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { diffChars } from "./js-diff.js";

export const CompareWindow = GObject.registerClass(
  {
    GTypeName: "CompareWindow",
    Template: getResourceUri("window.ui"),
    InternalChildren: ["text_view_before", "text_view_after"],
  },
  class CompareWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });
      this.createActions();
      this.createBuffer();
    }

    createBuffer = () => {
      this.buffer_before = Gtk.TextBuffer.new(null);
      this.buffer_after = Gtk.TextBuffer.new(null);

      const tagTableBefore = this.buffer_before.tag_table;
      const tagTableAfter = this.buffer_after.tag_table;

      tagTableBefore.add(
        new Gtk.TextTag({
          name: "redForeground",
          foreground: "red",
        })
      );
      tagTableBefore.add(
        new Gtk.TextTag({
          name: "blueForeground",
          foreground: "blue",
        })
      );

      tagTableAfter.add(
        new Gtk.TextTag({
          name: "redForeground",
          foreground: "red",
        })
      );
      tagTableAfter.add(
        new Gtk.TextTag({
          name: "blueForeground",
          foreground: "blue",
        })
      );

      this._text_view_before.buffer = this.buffer_before;
      this._text_view_after.buffer = this.buffer_after;
    };

    createActions = () => {
      const checkDiffAction = new Gio.SimpleAction({
        name: "check-diff",
      });

      checkDiffAction.connect("activate", () => {
        const textBefore = this.buffer_before.text;
        const textAfter = this.buffer_after.text;

        if (!textBefore && !textAfter) return;

        const changeObjects = diffChars(textBefore, textAfter);

        let offset = 0;
        let o = 0;

        for (const { added, removed, value } of changeObjects) {
          if (!added && !removed) {
            const length = [...value].length;
            offset += length;
            continue;
          }

          if (!added && removed) {
            const endOffset = offset + [...value].length;
            const startIter = this.buffer_before.get_iter_at_offset(offset);
            const endIter = this.buffer_before.get_iter_at_offset(endOffset);

            this.buffer_before.apply_tag_by_name(
              "redForeground",
              startIter,
              endIter
            );

            offset = endOffset;
            continue;
          }

          if (added && !removed) {
            const endOffset = o + [...value].length;

            const startIter = this.buffer_after.get_iter_at_offset(o);
            const endIter = this.buffer_after.get_iter_at_offset(endOffset);

            this.buffer_after.apply_tag_by_name(
              "blueForeground",
              startIter,
              endIter
            );

            o = endOffset;
            continue;
          }
        }
      });

      this.add_action(checkDiffAction);
    };
  }
);
