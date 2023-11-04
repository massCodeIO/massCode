import type { ITextmateThemePlus } from "codemirror-textmate";
import { addTheme } from "codemirror-textmate";
import type { Theme } from "@shared/types/renderer/store/app";

interface ThemeConfig {
  name: string; // Имя темы из файла .tmTheme.json
  label: string;
  value: Theme;
  loader: () => Promise<ITextmateThemePlus>;
  gutterSettings: {
    background: string;
    divider: string;
  };
}

export const themes: ThemeConfig[] = [
  {
    name: "Active4D",
    label: "Active4D",
    value: "dark:Active4D",
    loader: () => import("./themes/active4d.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "All Hallows Eve Custom",
    label: "All Hallows Eve Custom",
    value: "dark:All Hallows Eve Custom",
    loader: () => import("./themes/all-hallows-eve-custom.tmTheme.json"),
    gutterSettings: {
      background: "#131313",
      divider: "#131313",
    },
  },
  {
    name: "All Hallows Eve",
    label: "All Hallows Eve",
    value: "dark:All Hallows Eve",
    loader: () => import("./themes/all-hallows-eve.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Amy",
    label: "Amy",
    value: "dark:Amy",
    loader: () => import("./themes/amy.tmTheme.json"),
    gutterSettings: {
      background: "#200020",
      divider: "#200020",
    },
  },
  {
    name: "Argonaut",
    label: "Argonaut",
    value: "dark:Argonaut",
    loader: () => import("./themes/argonaut.tmTheme.json"),
    gutterSettings: {
      background: "#151515",
      divider: "#151515",
    },
  },
  {
    name: "barf",
    label: "barf",
    value: "dark:barf",
    loader: () => import("./themes/barf.tmTheme.json"),
    gutterSettings: {
      background: "#15191EFA",
      divider: "#15191EFA",
    },
  },
  {
    name: "BBEdit",
    label: "BBEdit",
    value: "dark:BBEdit",
    loader: () => import("./themes/bbedit.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Bespin",
    label: "Bespin",
    value: "dark:Bespin",
    loader: () => import("./themes/bespin.tmTheme.json"),
    gutterSettings: {
      background: "#28211C",
      divider: "#28211C",
    },
  },
  {
    name: "Birds of Paradise",
    label: "Birds of Paradise",
    value: "dark:Birds of Paradise",
    loader: () => import("./themes/birds-of-paradise.tmTheme.json"),
    gutterSettings: {
      background: "#372725",
      divider: "#372725",
    },
  },
  {
    name: "Black Pearl II",
    label: "Black Pearl II",
    value: "dark:Black Pearl II",
    loader: () => import("./themes/black-pearl-ii.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Black Pearl",
    label: "Black Pearl",
    value: "dark:Black Pearl",
    loader: () => import("./themes/black-pearl.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Blackboard Black",
    label: "Blackboard Black",
    value: "dark:Blackboard Black",
    loader: () => import("./themes/blackboard-black.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Blackboard Mod",
    label: "Blackboard Mod",
    value: "dark:Blackboard Mod",
    loader: () => import("./themes/blackboard-mod.tmTheme.json"),
    gutterSettings: {
      background: "#0B0D17E6",
      divider: "#0B0D17E6",
    },
  },
  {
    name: "Blackboard Mod",
    label: "Blackboard Mod",
    value: "dark:Blackboard Mod",
    loader: () => import("./themes/blackboard-new.tmTheme.json"),
    gutterSettings: {
      background: "#0B0D17E6",
      divider: "#0B0D17E6",
    },
  },
  {
    name: "Blackboard",
    label: "Blackboard",
    value: "dark:Blackboard",
    loader: () => import("./themes/blackboard.tmTheme.json"),
    gutterSettings: {
      background: "#0C1021",
      divider: "#0C1021",
    },
  },
  {
    name: "BlackLight",
    label: "BlackLight",
    value: "dark:BlackLight",
    loader: () => import("./themes/blacklight.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Bongzilla",
    label: "Bongzilla",
    value: "dark:Bongzilla",
    loader: () => import("./themes/bongzilla.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Brilliance Black",
    label: "Brilliance Black",
    value: "dark:Brilliance Black",
    loader: () => import("./themes/brilliance-black.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0DFA",
      divider: "#0D0D0DFA",
    },
  },
  {
    name: "Brilliance Dull",
    label: "Brilliance Dull",
    value: "dark:Brilliance Dull",
    loader: () => import("./themes/brilliance-dull.tmTheme.json"),
    gutterSettings: {
      background: "#050505FA",
      divider: "#050505FA",
    },
  },
  {
    name: "choco",
    label: "choco",
    value: "dark:choco",
    loader: () => import("./themes/choco.tmTheme.json"),
    gutterSettings: {
      background: "#180C0C",
      divider: "#180C0C",
    },
  },
  {
    name: "Claire",
    label: "Claire",
    value: "dark:Claire",
    loader: () => import("./themes/claire.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Classic Modified",
    label: "Classic Modified",
    value: "dark:Classic Modified",
    loader: () => import("./themes/classic-modified.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Close to the Sea",
    label: "Close to the Sea",
    value: "dark:Close to the Sea",
    loader: () => import("./themes/close_to_the_sea.tmTheme.json"),
    gutterSettings: {
      background: "#172024",
      divider: "#172024",
    },
  },
  {
    name: "Clouds Midnight",
    label: "Clouds Midnight",
    value: "dark:Clouds Midnight",
    loader: () => import("./themes/clouds-midnight.tmTheme.json"),
    gutterSettings: {
      background: "#191919",
      divider: "#191919",
    },
  },
  {
    name: "Clouds",
    label: "Clouds",
    value: "dark:Clouds",
    loader: () => import("./themes/clouds.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Coal Graal",
    label: "Coal Graal",
    value: "dark:Coal Graal",
    loader: () => import("./themes/coal-graal.tmTheme.json"),
    gutterSettings: {
      background: "#222222",
      divider: "#222222",
    },
  },
  {
    name: "Cobalt",
    label: "Cobalt",
    value: "dark:Cobalt",
    loader: () => import("./themes/cobalt.tmTheme.json"),
    gutterSettings: {
      background: "#002240",
      divider: "#002240",
    },
  },
  {
    name: "Coda.inkdeep",
    label: "Coda.inkdeep",
    value: "dark:Coda.inkdeep",
    loader: () => import("./themes/coda.inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Coda",
    label: "Coda",
    value: "dark:Coda",
    loader: () => import("./themes/coda.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Cool Glow",
    label: "Cool Glow",
    value: "dark:Cool Glow",
    loader: () => import("./themes/cool-glow.tmTheme.json"),
    gutterSettings: {
      background: "#06071DFA",
      divider: "#06071DFA",
    },
  },
  {
    name: "Creeper",
    label: "Creeper",
    value: "dark:Creeper",
    loader: () => import("./themes/creeper.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "CSSEdit",
    label: "CSSEdit",
    value: "dark:CSSEdit",
    loader: () => import("./themes/cssedit.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Daniel Fischer",
    label: "Daniel Fischer",
    value: "dark:Daniel Fischer",
    loader: () => import("./themes/daniel-fischer.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Dawn (custom)",
    label: "Dawn (custom)",
    value: "dark:Dawn (custom)",
    loader: () => import("./themes/dawn-mod1.tmTheme.json"),
    gutterSettings: {
      background: "#F9F9F9F2",
      divider: "#F9F9F9F2",
    },
  },
  {
    name: "Dawn",
    label: "Dawn",
    value: "dark:Dawn",
    loader: () => import("./themes/dawn.tmTheme.json"),
    gutterSettings: {
      background: "#F9F9F9",
      divider: "#F9F9F9",
    },
  },
  {
    name: "Deluxe",
    label: "Deluxe",
    value: "dark:Deluxe",
    loader: () => import("./themes/deluxe.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Django (Smoothy)",
    label: "Django (Smoothy)",
    value: "dark:Django (Smoothy)",
    loader: () => import("./themes/django-(smoothy).tmTheme.json"),
    gutterSettings: {
      background: "#245032",
      divider: "#245032",
    },
  },
  {
    name: "Django Dark",
    label: "Django Dark",
    value: "dark:Django Dark",
    loader: () => import("./themes/django-dark.tmTheme.json"),
    gutterSettings: {
      background: "#0A1C12",
      divider: "#0A1C12",
    },
  },
  {
    name: "Dominion Day",
    label: "Dominion Day",
    value: "dark:Dominion Day",
    loader: () => import("./themes/dominion-day.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Dracula",
    label: "Dracula",
    value: "dark:Dracula",
    loader: () => import("./themes/dracula.tmTheme.json"),
    gutterSettings: {
      background: "#282a36",
      divider: "#282a36",
    },
  },
  {
    name: "Eiffel",
    label: "Eiffel",
    value: "dark:Eiffel",
    loader: () => import("./themes/eiffel.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Emacs Strict",
    label: "Emacs Strict",
    value: "dark:Emacs Strict",
    loader: () => import("./themes/emacs-strict.tmTheme.json"),
    gutterSettings: {
      background: "#000000EB",
      divider: "#000000EB",
    },
  },
  {
    name: "Erebus",
    label: "Erebus",
    value: "dark:Erebus",
    loader: () => import("./themes/erebus.tmTheme.json"),
    gutterSettings: {
      background: "#140A0A",
      divider: "#140A0A",
    },
  },
  {
    name: "Espresso Libre",
    label: "Espresso Libre",
    value: "dark:Espresso Libre",
    loader: () => import("./themes/espresso-libre.tmTheme.json"),
    gutterSettings: {
      background: "#2A211C",
      divider: "#2A211C",
    },
  },
  {
    name: "Espresso Tutti",
    label: "Espresso Tutti",
    value: "dark:Espresso Tutti",
    loader: () => import("./themes/espresso-tutti.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Espresso",
    label: "Espresso",
    value: "dark:Espresso",
    loader: () => import("./themes/espresso.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Fade to Grey",
    label: "Fade to Grey",
    value: "dark:Fade to Grey",
    loader: () => import("./themes/fade-to-grey.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "fake",
    label: "fake",
    value: "dark:fake",
    loader: () => import("./themes/fake.tmTheme.json"),
    gutterSettings: {
      background: "#010304",
      divider: "#010304",
    },
  },
  {
    name: "Fluidvision",
    label: "Fluidvision",
    value: "dark:Fluidvision",
    loader: () => import("./themes/fluidvision.tmTheme.json"),
    gutterSettings: {
      background: "#F4F4F4F2",
      divider: "#F4F4F4F2",
    },
  },
  {
    name: "ForLaTeX",
    label: "ForLaTeX",
    value: "dark:ForLaTeX",
    loader: () => import("./themes/forlatex.tmTheme.json"),
    gutterSettings: {
      background: "#000000C7",
      divider: "#000000C7",
    },
  },
  {
    name: "Freckle",
    label: "Freckle",
    value: "dark:Freckle",
    loader: () => import("./themes/freckle-mod1.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Freckle (custom)",
    label: "Freckle (custom)",
    value: "dark:Freckle (custom)",
    loader: () => import("./themes/freckle-mod2.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFF0",
      divider: "#FFFFFFF0",
    },
  },
  {
    name: "Freckle",
    label: "Freckle",
    value: "dark:Freckle",
    loader: () => import("./themes/freckle.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Friendship Bracelet",
    label: "Friendship Bracelet",
    value: "dark:Friendship Bracelet",
    loader: () => import("./themes/friendship-bracelet.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Funky Dashboard",
    label: "Funky Dashboard",
    value: "dark:Funky Dashboard",
    loader: () => import("./themes/funky_dashboard.tmTheme.json"),
    gutterSettings: {
      background: "#000000D9",
      divider: "#000000D9",
    },
  },
  {
    name: "GitHub",
    label: "GitHub",
    value: "dark:GitHub",
    loader: () => import("./themes/github.tmTheme.json"),
    gutterSettings: {
      background: "#ffffff",
      divider: "#ffffff",
    },
  },
  {
    name: "GlitterBomb",
    label: "GlitterBomb",
    value: "dark:GlitterBomb",
    loader: () => import("./themes/glitterbomb.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A0A",
      divider: "#0B0A0A",
    },
  },
  {
    name: "Glow",
    label: "Glow",
    value: "dark:Glow",
    loader: () => import("./themes/glow.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Happy happy joy joy 2",
    label: "Happy happy joy joy 2",
    value: "dark:Happy happy joy joy 2",
    loader: () => import("./themes/happy-happy-joy-joy-2.tmTheme.json"),
    gutterSettings: {
      background: "#E5E5E5",
      divider: "#E5E5E5",
    },
  },
  {
    name: "Happy happy joy joy 2",
    label: "Happy happy joy joy 2",
    value: "dark:Happy happy joy joy 2",
    loader: () => import("./themes/happy-happy-joy-joy.tmTheme.json"),
    gutterSettings: {
      background: "#E5E5E5",
      divider: "#E5E5E5",
    },
  },
  {
    name: "Happydeluxe",
    label: "Happydeluxe",
    value: "dark:Happydeluxe",
    loader: () => import("./themes/happydeluxe.tmTheme.json"),
    gutterSettings: {
      background: "#0E131E",
      divider: "#0E131E",
    },
  },
  {
    name: "Heroku",
    label: "Heroku",
    value: "dark:Heroku",
    loader: () => import("./themes/heroku.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "HerokuCodeSamples",
    label: "HerokuCodeSamples",
    value: "dark:HerokuCodeSamples",
    loader: () => import("./themes/herokucodesamples.tmTheme.json"),
    gutterSettings: {
      background: "#39434B",
      divider: "#39434B",
    },
  },
  {
    name: "IDLE",
    label: "IDLE",
    value: "dark:IDLE",
    loader: () => import("./themes/idle.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "idleFingers",
    label: "idleFingers",
    value: "dark:idleFingers",
    loader: () => import("./themes/idlefingers.tmTheme.json"),
    gutterSettings: {
      background: "#323232",
      divider: "#323232",
    },
  },
  {
    name: "iLife 05",
    label: "iLife 05",
    value: "dark:iLife 05",
    loader: () => import("./themes/ilife-05.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFFC",
      divider: "#FFFFFFFC",
    },
  },
  {
    name: "iLife 06",
    label: "iLife 06",
    value: "dark:iLife 06",
    loader: () => import("./themes/ilife-06.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFFC",
      divider: "#FFFFFFFC",
    },
  },
  {
    name: "imathis",
    label: "imathis",
    value: "dark:imathis",
    loader: () => import("./themes/imathis.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "inkdeep",
    label: "inkdeep",
    value: "dark:inkdeep",
    loader: () => import("./themes/inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#040A12",
      divider: "#040A12",
    },
  },
  {
    name: "iPlastic",
    label: "iPlastic",
    value: "dark:iPlastic",
    loader: () => import("./themes/iplastic.tmTheme.json"),
    gutterSettings: {
      background: "#EEEEEEEB",
      divider: "#EEEEEEEB",
    },
  },
  {
    name: "IR_Black",
    label: "IR_Black",
    value: "dark:IR_Black",
    loader: () => import("./themes/ir_black.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "IR_White",
    label: "IR_White",
    value: "dark:IR_White",
    loader: () => import("./themes/ir_white.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Juicy",
    label: "Juicy",
    value: "dark:Juicy",
    loader: () => import("./themes/juicy.tmTheme.json"),
    gutterSettings: {
      background: "#F1F1F1",
      divider: "#F1F1F1",
    },
  },
  {
    name: "krTheme",
    label: "krTheme",
    value: "dark:krTheme",
    loader: () => import("./themes/krtheme.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A09",
      divider: "#0B0A09",
    },
  },
  {
    name: "LAZY.inkdeep",
    label: "LAZY.inkdeep",
    value: "dark:LAZY.inkdeep",
    loader: () => import("./themes/lazy.inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "LAZY",
    label: "LAZY",
    value: "dark:LAZY",
    loader: () => import("./themes/lazy.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Lowlight",
    label: "Lowlight",
    value: "dark:Lowlight",
    loader: () => import("./themes/lowlight.tmTheme.json"),
    gutterSettings: {
      background: "#1E1E1E",
      divider: "#1E1E1E",
    },
  },
  {
    name: "Mac Classic",
    label: "Mac Classic",
    value: "dark:Mac Classic",
    loader: () => import("./themes/mac-classic.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Made of Code",
    label: "Made of Code",
    value: "dark:Made of Code",
    loader: () => import("./themes/made-of-code.tmTheme.json"),
    gutterSettings: {
      background: "#090A1BF2",
      divider: "#090A1BF2",
    },
  },
  {
    name: "MagicWB (Amiga)",
    label: "MagicWB (Amiga)",
    value: "dark:MagicWB (Amiga)",
    loader: () => import("./themes/magicwb-(amiga).tmTheme.json"),
    gutterSettings: {
      background: "#969696",
      divider: "#969696",
    },
  },
  {
    name: "Material-Theme-Lighter",
    label: "Material-Theme-Lighter",
    value: "dark:Material-Theme-Lighter",
    loader: () => import("./themes/material-theme-lighter.tmTheme.json"),
    gutterSettings: {
      background: "#FAFAFA",
      divider: "#FAFAFA",
    },
  },
  {
    name: "Material-Theme-Palenight",
    label: "Material-Theme-Palenight",
    value: "dark:Material-Theme-Palenight",
    loader: () => import("./themes/material-theme-palenight.tmTheme.json"),
    gutterSettings: {
      background: "#3B8070FF",
      divider: "#3B8070FF",
    },
  },
  {
    name: "Material-Theme",
    label: "Material-Theme",
    value: "dark:Material-Theme",
    loader: () => import("./themes/material-theme.tmTheme.json"),
    gutterSettings: {
      background: "#263238",
      divider: "#263238",
    },
  },
  {
    name: "Menage A Trois",
    label: "Menage A Trois",
    value: "dark:Menage A Trois",
    loader: () => import("./themes/menage-a-trois.tmTheme.json"),
    gutterSettings: {
      background: "#0F1014",
      divider: "#0F1014",
    },
  },
  {
    name: "Merbivore-Soft",
    label: "Merbivore-Soft",
    value: "dark:Merbivore-Soft",
    loader: () => import("./themes/merbivore-soft.tmTheme.json"),
    gutterSettings: {
      background: "#1C1C1C",
      divider: "#1C1C1C",
    },
  },
  {
    name: "Merbivore",
    label: "Merbivore",
    value: "dark:Merbivore",
    loader: () => import("./themes/merbivore.tmTheme.json"),
    gutterSettings: {
      background: "#161616",
      divider: "#161616",
    },
  },
  {
    name: "Midnight",
    label: "Midnight",
    value: "dark:Midnight",
    loader: () => import("./themes/midnight.tmTheme.json"),
    gutterSettings: {
      background: "#0A001FE3",
      divider: "#0A001FE3",
    },
  },
  {
    name: "minimal Theme",
    label: "minimal Theme",
    value: "dark:minimal Theme",
    loader: () => import("./themes/minimal-theme.tmTheme.json"),
    gutterSettings: {
      background: "#302D26",
      divider: "#302D26",
    },
  },
  {
    name: "monoindustrial",
    label: "monoindustrial",
    value: "dark:monoindustrial",
    loader: () => import("./themes/monoindustrial.tmTheme.json"),
    gutterSettings: {
      background: "#222C28",
      divider: "#222C28",
    },
  },
  {
    name: "Monokai Dark",
    label: "Monokai Dark",
    value: "dark:Monokai Dark",
    loader: () => import("./themes/monokai-dark.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Monokai for Textmaters CUSTOM (philtrMod)",
    label: "Monokai for Textmaters CUSTOM (philtrMod)",
    value: "dark:Monokai for Textmaters CUSTOM (philtrMod)",
    loader: () =>
      import("./themes/monokai-for-textmaters-custom-(philtr).tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai for Textmaters CUSTOM",
    label: "Monokai for Textmaters CUSTOM",
    value: "dark:Monokai for Textmaters CUSTOM",
    loader: () => import("./themes/monokai-for-textmaters-custom.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai Mod",
    label: "Monokai Mod",
    value: "dark:Monokai Mod",
    loader: () => import("./themes/monokai-mod-(seangaffney).tmTheme.json"),
    gutterSettings: {
      background: "#1D1E19F2",
      divider: "#1D1E19F2",
    },
  },
  {
    name: "Monokai for Textmaters CUSTOM",
    label: "Monokai for Textmaters CUSTOM",
    value: "dark:Monokai for Textmaters CUSTOM",
    loader: () => import("./themes/monokai-mod-1.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai Mod",
    label: "Monokai Mod",
    value: "dark:Monokai Mod",
    loader: () => import("./themes/monokai-mod.tmTheme.json"),
    gutterSettings: {
      background: "#1D1E19F2",
      divider: "#1D1E19F2",
    },
  },
  {
    name: "Monokai",
    label: "Monokai",
    value: "dark:Monokai",
    loader: () => import("./themes/monokai.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "MultiMarkdown",
    label: "MultiMarkdown",
    value: "dark:MultiMarkdown",
    loader: () => import("./themes/multimarkdown.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Notebook",
    label: "Notebook",
    value: "dark:Notebook",
    loader: () => import("./themes/notebook.tmTheme.json"),
    gutterSettings: {
      background: "#BEB69D",
      divider: "#BEB69D",
    },
  },
  {
    name: "Notepad 2",
    label: "Notepad 2",
    value: "dark:Notepad 2",
    loader: () => import("./themes/notepad2.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Oceanic",
    label: "Oceanic",
    value: "dark:Oceanic",
    loader: () => import("./themes/oceanic.tmTheme.json"),
    gutterSettings: {
      background: "#1B2630",
      divider: "#1B2630",
    },
  },
  {
    name: "Offy",
    label: "Offy",
    value: "dark:Offy",
    loader: () => import("./themes/offy.tmTheme.json"),
    gutterSettings: {
      background: "#00002ECC",
      divider: "#00002ECC",
    },
  },
  {
    name: "One-Dark",
    label: "One-Dark",
    value: "dark:One-Dark",
    loader: () => import("./themes/one-dark.tmTheme.json"),
    gutterSettings: {
      background: "#282c34",
      divider: "#282c34",
    },
  },
  {
    name: "Pastels on Dark",
    label: "Pastels on Dark",
    value: "dark:Pastels on Dark",
    loader: () => import("./themes/pastels-on-dark.tmTheme.json"),
    gutterSettings: {
      background: "#211E1E",
      divider: "#211E1E",
    },
  },
  {
    name: "Pastie",
    label: "Pastie",
    value: "dark:Pastie",
    loader: () => import("./themes/pastie.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Pengwynn menlo",
    label: "Pengwynn menlo",
    value: "dark:Pengwynn menlo",
    loader: () => import("./themes/pengwynn-menlo.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Pengwynn",
    label: "Pengwynn",
    value: "dark:Pengwynn",
    loader: () => import("./themes/pengwynn.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Plum Dumb",
    label: "Plum Dumb",
    value: "dark:Plum Dumb",
    loader: () => import("./themes/plum-dumb.tmTheme.json"),
    gutterSettings: {
      background: "#00000BF7",
      divider: "#00000BF7",
    },
  },
  {
    name: "Putty",
    label: "Putty",
    value: "dark:Putty",
    loader: () => import("./themes/putty.tmTheme.json"),
    gutterSettings: {
      background: "#242322",
      divider: "#242322",
    },
  },
  {
    name: "Rails Envy",
    label: "Rails Envy",
    value: "dark:Rails Envy",
    loader: () => import("./themes/rails-envy.tmTheme.json"),
    gutterSettings: {
      background: "#121210",
      divider: "#121210",
    },
  },
  {
    name: "Railscasts - boost",
    label: "Railscasts - boost",
    value: "dark:Railscasts - boost",
    loader: () => import("./themes/railscasts---boost.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Railscasts",
    label: "Railscasts",
    value: "dark:Railscasts",
    loader: () => import("./themes/railscasts.tmTheme.json"),
    gutterSettings: {
      background: "#2B2B2B",
      divider: "#2B2B2B",
    },
  },
  {
    name: "RDark",
    label: "RDark",
    value: "dark:RDark",
    loader: () => import("./themes/rdark.tmTheme.json"),
    gutterSettings: {
      background: "#1B2426",
      divider: "#1B2426",
    },
  },
  {
    name: "Resesif",
    label: "Resesif",
    value: "dark:Resesif",
    loader: () => import("./themes/resesif.tmTheme.json"),
    gutterSettings: {
      background: "#2B2B2B",
      divider: "#2B2B2B",
    },
  },
  {
    name: "Ruby Blue",
    label: "Ruby Blue",
    value: "dark:Ruby Blue",
    loader: () => import("./themes/ruby-blue.tmTheme.json"),
    gutterSettings: {
      background: "#121E31",
      divider: "#121E31",
    },
  },
  {
    name: "RubyRobot",
    label: "RubyRobot",
    value: "dark:RubyRobot",
    loader: () => import("./themes/rubyrobot.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Ryan Light",
    label: "Ryan Light",
    value: "dark:Ryan Light",
    loader: () => import("./themes/ryan-light.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Sidewalk Chalk",
    label: "Sidewalk Chalk",
    value: "dark:Sidewalk Chalk",
    loader: () => import("./themes/sidewalkchalk.tmTheme.json"),
    gutterSettings: {
      background: "#2B2D2E",
      divider: "#2B2D2E",
    },
  },
  {
    name: "Sidewalk Chalk Green Mod",
    label: "Sidewalk Chalk Green Mod",
    value: "dark:Sidewalk Chalk Green Mod",
    loader: () => import("./themes/sidewalkchalkgreenmod.tmTheme.json"),
    gutterSettings: {
      background: "#2B2D2E",
      divider: "#2B2D2E",
    },
  },
  {
    name: "Smoothy",
    label: "Smoothy",
    value: "dark:Smoothy",
    loader: () => import("./themes/smoothy.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Solarized (dark)",
    label: "Solarized (dark)",
    value: "dark:Solarized (dark)",
    loader: () => import("./themes/solarized-(dark).tmTheme.json"),
    gutterSettings: {
      background: "#042029",
      divider: "#042029",
    },
  },
  {
    name: "Solarized (light)",
    label: "Solarized (light)",
    value: "dark:Solarized (light)",
    loader: () => import("./themes/solarized-(light).tmTheme.json"),
    gutterSettings: {
      background: "#FDF6E3",
      divider: "#FDF6E3",
    },
  },
  {
    name: "Solarized-Light",
    label: "Solarized-Light",
    value: "dark:Solarized-Light",
    loader: () => import("./themes/solarized-light.tmTheme.json"),
    gutterSettings: {
      background: "#FDF6E3",
      divider: "#FDF6E3",
    },
  },
  {
    name: "SpaceCadet",
    label: "SpaceCadet",
    value: "dark:SpaceCadet",
    loader: () => import("./themes/spacecadet.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Spectacular",
    label: "Spectacular",
    value: "dark:Spectacular",
    loader: () => import("./themes/spectacular.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A0A",
      divider: "#0B0A0A",
    },
  },
  {
    name: "Starlight",
    label: "Starlight",
    value: "dark:Starlight",
    loader: () => import("./themes/starlight.tmTheme.json"),
    gutterSettings: {
      background: "#223859F2",
      divider: "#223859F2",
    },
  },
  {
    name: "Succulent",
    label: "Succulent",
    value: "dark:Succulent",
    loader: () => import("./themes/succulent_1.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Summer Camp Daybreak",
    label: "Summer Camp Daybreak",
    value: "dark:Summer Camp Daybreak",
    loader: () => import("./themes/summer-camp-daybreak.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Summer Camp Mod",
    label: "Summer Camp Mod",
    value: "dark:Summer Camp Mod",
    loader: () => import("./themes/summer-camp-mod.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Summer Sun",
    label: "Summer Sun",
    value: "dark:Summer Sun",
    loader: () => import("./themes/summer-sun.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Sunburst",
    label: "Sunburst",
    value: "dark:Sunburst",
    loader: () => import("./themes/sunburst.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Sweyla Theme (650478)",
    label: "Sweyla Theme (650478)",
    value: "dark:Sweyla Theme (650478)",
    loader: () => import("./themes/sweyla650478.tmTheme.json"),
    gutterSettings: {
      background: "#020306",
      divider: "#020306",
    },
  },
  {
    name: "Sweyla Theme (674314)",
    label: "Sweyla Theme (674314)",
    value: "dark:Sweyla Theme (674314)",
    loader: () => import("./themes/sweyla674314.tmTheme.json"),
    gutterSettings: {
      background: "#0E0C00",
      divider: "#0E0C00",
    },
  },
  {
    name: "Swyphs II",
    label: "Swyphs II",
    value: "dark:Swyphs II",
    loader: () => import("./themes/swyphs-ii.tmTheme.json"),
    gutterSettings: {
      background: "#000000FA",
      divider: "#000000FA",
    },
  },
  {
    name: "Tango in Twilight",
    label: "Tango in Twilight",
    value: "dark:Tango in Twilight",
    loader: () => import("./themes/tango-in-twilight.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Tango",
    label: "Tango",
    value: "dark:Tango",
    loader: () => import("./themes/tango.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Tek",
    label: "Tek",
    value: "dark:Tek",
    loader: () => import("./themes/tek.tmTheme.json"),
    gutterSettings: {
      background: "#2F4F4F",
      divider: "#2F4F4F",
    },
  },
  {
    name: "Text Ex Machina (Lighter comments)",
    label: "Text Ex Machina (Lighter comments)",
    value: "dark:Text Ex Machina (Lighter comments)",
    loader: () =>
      import("./themes/text-ex-machina-(lighter-comments).tmTheme.json"),
    gutterSettings: {
      background: "#151515",
      divider: "#151515",
    },
  },
  {
    name: "Text Ex Machina",
    label: "Text Ex Machina",
    value: "dark:Text Ex Machina",
    loader: () => import("./themes/text-ex-machina.tmTheme.json"),
    gutterSettings: {
      background: "#151515",
      divider: "#151515",
    },
  },
  {
    name: "Tokyo-Night",
    label: "Tokyo-Night",
    value: "dark:Tokyo-Night",
    loader: () => import("./themes/tokyo-night.tmTheme.json"),
    gutterSettings: {
      background: "#1d1f29",
      divider: "#1d1f29",
    },
  },
  {
    name: "Tomorrow Night - Blue",
    label: "Tomorrow Night - Blue",
    value: "dark:Tomorrow Night - Blue",
    loader: () => import("./themes/tomorrow-night-blue.tmTheme.json"),
    gutterSettings: {
      background: "#002451",
      divider: "#002451",
    },
  },
  {
    name: "Tomorrow Night - Bright",
    label: "Tomorrow Night - Bright",
    value: "dark:Tomorrow Night - Bright",
    loader: () => import("./themes/tomorrow-night-bright.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Tomorrow Night - Eighties",
    label: "Tomorrow Night - Eighties",
    value: "dark:Tomorrow Night - Eighties",
    loader: () => import("./themes/tomorrow-night-eighties.tmTheme.json"),
    gutterSettings: {
      background: "#2D2D2D",
      divider: "#2D2D2D",
    },
  },
  {
    name: "Tomorrow Night",
    label: "Tomorrow Night",
    value: "dark:Tomorrow Night",
    loader: () => import("./themes/tomorrow-night.tmTheme.json"),
    gutterSettings: {
      background: "#1D1F21",
      divider: "#1D1F21",
    },
  },
  {
    name: "Tomorrow Night",
    label: "Tomorrow Night",
    value: "dark:Tomorrow Night",
    loader: () => import("./themes/tomorrow-night2.tmTheme.json"),
    gutterSettings: {
      background: "#1D1F21",
      divider: "#1D1F21",
    },
  },
  {
    name: "Tomorrow",
    label: "Tomorrow",
    value: "dark:Tomorrow",
    loader: () => import("./themes/tomorrow.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Tubster",
    label: "Tubster",
    value: "dark:Tubster",
    loader: () => import("./themes/tubster.tmTheme.json"),
    gutterSettings: {
      background: "#232323",
      divider: "#232323",
    },
  },
  {
    name: "Twilight Bright",
    label: "Twilight Bright",
    value: "dark:Twilight Bright",
    loader: () => import("./themes/twilight-bright.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Twilight REMIX",
    label: "Twilight REMIX",
    value: "dark:Twilight REMIX",
    loader: () => import("./themes/twilight-remix.tmTheme.json"),
    gutterSettings: {
      background: "#030303",
      divider: "#030303",
    },
  },
  {
    name: "Twilight",
    label: "Twilight",
    value: "dark:Twilight",
    loader: () => import("./themes/twilight.tmTheme.json"),
    gutterSettings: {
      background: "#141414",
      divider: "#141414",
    },
  },
  {
    name: "Upstream Sunburst",
    label: "Upstream Sunburst",
    value: "dark:Upstream Sunburst",
    loader: () => import("./themes/upstream-sunburst.tmTheme.json"),
    gutterSettings: {
      background: "#000000F7",
      divider: "#000000F7",
    },
  },
  {
    name: "Upstream Vibrant",
    label: "Upstream Vibrant",
    value: "dark:Upstream Vibrant",
    loader: () => import("./themes/upstream-vibrant.tmTheme.json"),
    gutterSettings: {
      background: "#000000D9",
      divider: "#000000D9",
    },
  },
  {
    name: "Venom",
    label: "Venom",
    value: "dark:Venom",
    loader: () => import("./themes/venom.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Vibrant Fin",
    label: "Vibrant Fin",
    value: "dark:Vibrant Fin",
    loader: () => import("./themes/vibrant-fin.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Vibrant Ink choppedNscrewed",
    label: "Vibrant Ink choppedNscrewed",
    value: "dark:Vibrant Ink choppedNscrewed",
    loader: () => import("./themes/vibrant-ink-choppednscrewed.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Ink remix",
    label: "Vibrant Ink remix",
    value: "dark:Vibrant Ink remix",
    loader: () => import("./themes/vibrant-ink-remix.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Ink",
    label: "Vibrant Ink",
    value: "dark:Vibrant Ink",
    loader: () => import("./themes/vibrant-ink.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Tango",
    label: "Vibrant Tango",
    value: "dark:Vibrant Tango",
    loader: () => import("./themes/vibrant-tango.tmTheme.json"),
    gutterSettings: {
      background: "#191D1E",
      divider: "#191D1E",
    },
  },
  {
    name: "Vintage Aurora",
    label: "Vintage Aurora",
    value: "dark:Vintage Aurora",
    loader: () => import("./themes/vintage-aurora.tmTheme.json"),
    gutterSettings: {
      background: "#2E0026DE",
      divider: "#2E0026DE",
    },
  },
  {
    name: "Why’s Poignant",
    label: "Why’s Poignant",
    value: "dark:Why’s Poignant",
    loader: () => import("./themes/whys-poignant.tmTheme.json"),
    gutterSettings: {
      background: "#FFFEF9",
      divider: "#FFFEF9",
    },
  },
  {
    name: "Zachstronaut Theme 4.1",
    label: "Zachstronaut Theme 4.1",
    value: "dark:Zachstronaut Theme 4.1",
    loader: () => import("./themes/zachstronaut-theme-4.1.tmTheme.json"),
    gutterSettings: {
      background: "#181310FA",
      divider: "#181310FA",
    },
  },
  {
    name: "zenburn",
    label: "zenburn",
    value: "dark:zenburn",
    loader: () => import("./themes/zenburn.tmTheme.json"),
    gutterSettings: {
      background: "#393939",
      divider: "#393939",
    },
  },
  {
    name: "Zenburnesque",
    label: "Zenburnesque",
    value: "dark:Zenburnesque",
    loader: () => import("./themes/zenburnesque.tmTheme.json"),
    gutterSettings: {
      background: "#404040",
      divider: "#404040",
    },
  },
];

export const loadThemes = async () => {
  for (const i of themes) {
    const config = await i.loader();
    const theme = {
      ...config,
      gutterSettings: i.gutterSettings,
    };
    addTheme(theme);
  }
};

export const setTheme = async (theme: Theme, editor: CodeMirror.Editor) => {
  const name = getThemeName(theme);
  if (name) editor.setOption("theme", name);
};

export const getThemeName = (theme: Theme) =>
  themes.find((i) => i.value === theme)?.name;
