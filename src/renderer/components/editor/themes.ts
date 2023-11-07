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
    value: "light:active4d",
    loader: () => import("./themes/active4d.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "All Hallows Eve Custom",
    label: "All Hallows Eve Custom",
    value: "light:all-hallows-eve-custom",
    loader: () => import("./themes/all-hallows-eve-custom.tmTheme.json"),
    gutterSettings: {
      background: "#131313",
      divider: "#131313",
    },
  },
  {
    name: "All Hallows Eve",
    label: "All Hallows Eve",
    value: "light:all-hallows-eve",
    loader: () => import("./themes/all-hallows-eve.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Amy",
    label: "Amy",
    value: "light:amy",
    loader: () => import("./themes/amy.tmTheme.json"),
    gutterSettings: {
      background: "#200020",
      divider: "#200020",
    },
  },
  {
    name: "Argonaut",
    label: "Argonaut",
    value: "light:argonaut",
    loader: () => import("./themes/argonaut.tmTheme.json"),
    gutterSettings: {
      background: "#151515",
      divider: "#151515",
    },
  },
  {
    name: "Barf",
    label: "Barf",
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
    value: "light:bbedit",
    loader: () => import("./themes/bbedit.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Bespin",
    label: "Bespin",
    value: "dark:bespin",
    loader: () => import("./themes/bespin.tmTheme.json"),
    gutterSettings: {
      background: "#28211C",
      divider: "#28211C",
    },
  },
  {
    name: "Birds of Paradise",
    label: "Birds of Paradise",
    value: "light:birds-of-paradise",
    loader: () => import("./themes/birds-of-paradise.tmTheme.json"),
    gutterSettings: {
      background: "#372725",
      divider: "#372725",
    },
  },
  {
    name: "Black Pearl II",
    label: "Black Pearl II",
    value: "light:black-pearl-ii",
    loader: () => import("./themes/black-pearl-ii.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Black Pearl",
    label: "Black Pearl",
    value: "light:black-pearl",
    loader: () => import("./themes/black-pearl.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Blackboard Black",
    label: "Blackboard Black",
    value: "dark:blackboard-black",
    loader: () => import("./themes/blackboard-black.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Blackboard Mod",
    label: "Blackboard Mod",
    value: "dark:blackboard-mod",
    loader: () => import("./themes/blackboard-mod.tmTheme.json"),
    gutterSettings: {
      background: "#0B0D17E6",
      divider: "#0B0D17E6",
    },
  },
  {
    name: "Blackboard New",
    label: "Blackboard New",
    value: "dark:blackboard-new",
    loader: () => import("./themes/blackboard-new.tmTheme.json"),
    gutterSettings: {
      background: "#0B0D17E6",
      divider: "#0B0D17E6",
    },
  },
  {
    name: "Blackboard",
    label: "Blackboard",
    value: "dark:blackboard",
    loader: () => import("./themes/blackboard.tmTheme.json"),
    gutterSettings: {
      background: "#0C1021",
      divider: "#0C1021",
    },
  },
  {
    name: "BlackLight",
    label: "BlackLight",
    value: "dark:blacklight",
    loader: () => import("./themes/blacklight.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Bongzilla",
    label: "Bongzilla",
    value: "dark:bongzilla",
    loader: () => import("./themes/bongzilla.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Brilliance Black",
    label: "Brilliance Black",
    value: "light:brilliance-black",
    loader: () => import("./themes/brilliance-black.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0DFA",
      divider: "#0D0D0DFA",
    },
  },
  {
    name: "Brilliance Dull",
    label: "Brilliance Dull",
    value: "light:brilliance-dull",
    loader: () => import("./themes/brilliance-dull.tmTheme.json"),
    gutterSettings: {
      background: "#050505FA",
      divider: "#050505FA",
    },
  },
  {
    name: "Choco",
    label: "Choco",
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
    value: "dark:claire",
    loader: () => import("./themes/claire.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Classic Modified",
    label: "Classic Modified",
    value: "light:classic-modified",
    loader: () => import("./themes/classic-modified.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Close to the Sea",
    label: "Close to the Sea",
    value: "light:close-to-the-sea",
    loader: () => import("./themes/close_to_the_sea.tmTheme.json"),
    gutterSettings: {
      background: "#172024",
      divider: "#172024",
    },
  },
  {
    name: "Clouds Midnight",
    label: "Clouds Midnight",
    value: "light:clouds-midnight",
    loader: () => import("./themes/clouds-midnight.tmTheme.json"),
    gutterSettings: {
      background: "#191919",
      divider: "#191919",
    },
  },
  {
    name: "Clouds",
    label: "Clouds",
    value: "light:clouds",
    loader: () => import("./themes/clouds.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Coal Graal",
    label: "Coal Graal",
    value: "light:coal-graal",
    loader: () => import("./themes/coal-graal.tmTheme.json"),
    gutterSettings: {
      background: "#222222",
      divider: "#222222",
    },
  },
  {
    name: "Cobalt",
    label: "Cobalt",
    value: "dark:cobalt",
    loader: () => import("./themes/cobalt.tmTheme.json"),
    gutterSettings: {
      background: "#002240",
      divider: "#002240",
    },
  },
  {
    name: "Coda.Inkdeep",
    label: "Coda.Inkdeep",
    value: "light:coda.inkdeep",
    loader: () => import("./themes/coda.inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Coda",
    label: "Coda",
    value: "light:coda",
    loader: () => import("./themes/coda.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Cool Glow",
    label: "Cool Glow",
    value: "light:cool-glow",
    loader: () => import("./themes/cool-glow.tmTheme.json"),
    gutterSettings: {
      background: "#06071DFA",
      divider: "#06071DFA",
    },
  },
  {
    name: "Creeper",
    label: "Creeper",
    value: "dark:creeper",
    loader: () => import("./themes/creeper.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "CSSEdit",
    label: "CSSEdit",
    value: "light:cssedit",
    loader: () => import("./themes/cssedit.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Daniel Fischer",
    label: "Daniel Fischer",
    value: "light:daniel-fischer",
    loader: () => import("./themes/daniel-fischer.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Dawn (custom)",
    label: "Dawn (custom)",
    value: "light:dawn-(custom)",
    loader: () => import("./themes/dawn-mod1.tmTheme.json"),
    gutterSettings: {
      background: "#F9F9F9F2",
      divider: "#F9F9F9F2",
    },
  },
  {
    name: "Dawn",
    label: "Dawn",
    value: "light:dawn",
    loader: () => import("./themes/dawn.tmTheme.json"),
    gutterSettings: {
      background: "#F9F9F9",
      divider: "#F9F9F9",
    },
  },
  {
    name: "Deluxe",
    label: "Deluxe",
    value: "dark:deluxe",
    loader: () => import("./themes/deluxe.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Django (Smoothy)",
    label: "Django (Smoothy)",
    value: "light:django-(smoothy)",
    loader: () => import("./themes/django-(smoothy).tmTheme.json"),
    gutterSettings: {
      background: "#245032",
      divider: "#245032",
    },
  },
  {
    name: "Django Dark",
    label: "Django Dark",
    value: "light:django-dark",
    loader: () => import("./themes/django-dark.tmTheme.json"),
    gutterSettings: {
      background: "#0A1C12",
      divider: "#0A1C12",
    },
  },
  {
    name: "Dominion Day",
    label: "Dominion Day",
    value: "light:dominion-day",
    loader: () => import("./themes/dominion-day.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Dracula",
    label: "Dracula",
    value: "dark:dracula",
    loader: () => import("./themes/dracula.tmTheme.json"),
    gutterSettings: {
      background: "#282a36",
      divider: "#282a36",
    },
  },
  {
    name: "Eiffel",
    label: "Eiffel",
    value: "light:eiffel",
    loader: () => import("./themes/eiffel.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Emacs Strict",
    label: "Emacs Strict",
    value: "light:emacs-strict",
    loader: () => import("./themes/emacs-strict.tmTheme.json"),
    gutterSettings: {
      background: "#000000EB",
      divider: "#000000EB",
    },
  },
  {
    name: "Erebus",
    label: "Erebus",
    value: "dark:erebus",
    loader: () => import("./themes/erebus.tmTheme.json"),
    gutterSettings: {
      background: "#140A0A",
      divider: "#140A0A",
    },
  },
  {
    name: "Espresso Libre",
    label: "Espresso Libre",
    value: "light:espresso-libre",
    loader: () => import("./themes/espresso-libre.tmTheme.json"),
    gutterSettings: {
      background: "#2A211C",
      divider: "#2A211C",
    },
  },
  {
    name: "Espresso Tutti",
    label: "Espresso Tutti",
    value: "light:espresso-tutti",
    loader: () => import("./themes/espresso-tutti.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Espresso",
    label: "Espresso",
    value: "light:espresso",
    loader: () => import("./themes/espresso.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Fade to Grey",
    label: "Fade to Grey",
    value: "light:fade-to-grey",
    loader: () => import("./themes/fade-to-grey.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Fake",
    label: "Fake",
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
    value: "light:fluidvision",
    loader: () => import("./themes/fluidvision.tmTheme.json"),
    gutterSettings: {
      background: "#F4F4F4F2",
      divider: "#F4F4F4F2",
    },
  },
  {
    name: "ForLaTeX",
    label: "ForLaTeX",
    value: "dark:forlatex",
    loader: () => import("./themes/forlatex.tmTheme.json"),
    gutterSettings: {
      background: "#000000C7",
      divider: "#000000C7",
    },
  },
  {
    name: "Freckle",
    label: "Freckle",
    value: "light:freckle",
    loader: () => import("./themes/freckle.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Freckle Mod",
    label: "Freckle Mod",
    value: "light:freckle-mod",
    loader: () => import("./themes/freckle-mod.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Freckle Mod 2",
    label: "Freckle Mod 2",
    value: "light:freckle-mod-2",
    loader: () => import("./themes/freckle-mod-2.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFF0",
      divider: "#FFFFFFF0",
    },
  },
  {
    name: "Friendship Bracelet",
    label: "Friendship Bracelet",
    value: "light:friendship-bracelet",
    loader: () => import("./themes/friendship-bracelet.tmTheme.json"),
    gutterSettings: {
      background: "#1F1F1F",
      divider: "#1F1F1F",
    },
  },
  {
    name: "Funky Dashboard",
    label: "Funky Dashboard",
    value: "light:funky-dashboard",
    loader: () => import("./themes/funky_dashboard.tmTheme.json"),
    gutterSettings: {
      background: "#000000D9",
      divider: "#000000D9",
    },
  },
  {
    name: "GitHub",
    label: "GitHub",
    value: "light:github",
    loader: () => import("./themes/github.tmTheme.json"),
    gutterSettings: {
      background: "#ffffff",
      divider: "#ffffff",
    },
  },
  {
    name: "GlitterBomb",
    label: "GlitterBomb",
    value: "dark:glitterbomb",
    loader: () => import("./themes/glitterbomb.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A0A",
      divider: "#0B0A0A",
    },
  },
  {
    name: "Glow",
    label: "Glow",
    value: "dark:glow",
    loader: () => import("./themes/glow.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Happy happy joy joy",
    label: "Happy happy joy joy",
    value: "light:happy-happy-joy-joy",
    loader: () => import("./themes/happy-happy-joy-joy.tmTheme.json"),
    gutterSettings: {
      background: "#E5E5E5",
      divider: "#E5E5E5",
    },
  },
  {
    name: "Happy happy joy joy 2",
    label: "Happy happy joy joy 2",
    value: "light:happy-happy-joy-joy-2",
    loader: () => import("./themes/happy-happy-joy-joy-2.tmTheme.json"),
    gutterSettings: {
      background: "#E5E5E5",
      divider: "#E5E5E5",
    },
  },
  {
    name: "Happydeluxe",
    label: "Happydeluxe",
    value: "dark:happydeluxe",
    loader: () => import("./themes/happydeluxe.tmTheme.json"),
    gutterSettings: {
      background: "#0E131E",
      divider: "#0E131E",
    },
  },
  {
    name: "Heroku",
    label: "Heroku",
    value: "dark:heroku",
    loader: () => import("./themes/heroku.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "HerokuCodeSamples",
    label: "HerokuCodeSamples",
    value: "dark:herokucodesamples",
    loader: () => import("./themes/herokucodesamples.tmTheme.json"),
    gutterSettings: {
      background: "#39434B",
      divider: "#39434B",
    },
  },
  {
    name: "IDLE",
    label: "IDLE",
    value: "light:idle",
    loader: () => import("./themes/idle.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "IdleFingers",
    label: "IdleFingers",
    value: "dark:idlefingers",
    loader: () => import("./themes/idlefingers.tmTheme.json"),
    gutterSettings: {
      background: "#323232",
      divider: "#323232",
    },
  },
  {
    name: "ILife 05",
    label: "ILife 05",
    value: "light:ilife-05",
    loader: () => import("./themes/ilife-05.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFFC",
      divider: "#FFFFFFFC",
    },
  },
  {
    name: "ILife 06",
    label: "ILife 06",
    value: "light:ilife-06",
    loader: () => import("./themes/ilife-06.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFFFC",
      divider: "#FFFFFFFC",
    },
  },
  {
    name: "Imathis",
    label: "Imathis",
    value: "dark:imathis",
    loader: () => import("./themes/imathis.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Inkdeep",
    label: "Inkdeep",
    value: "dark:inkdeep",
    loader: () => import("./themes/inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#040A12",
      divider: "#040A12",
    },
  },
  {
    name: "IPlastic",
    label: "IPlastic",
    value: "light:iplastic",
    loader: () => import("./themes/iplastic.tmTheme.json"),
    gutterSettings: {
      background: "#EEEEEEEB",
      divider: "#EEEEEEEB",
    },
  },
  {
    name: "IR Black",
    label: "IR Black",
    value: "dark:ir-black",
    loader: () => import("./themes/ir-black.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "IR White",
    label: "IR White",
    value: "light:ir-white",
    loader: () => import("./themes/ir-white.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Juicy",
    label: "Juicy",
    value: "light:juicy",
    loader: () => import("./themes/juicy.tmTheme.json"),
    gutterSettings: {
      background: "#F1F1F1",
      divider: "#F1F1F1",
    },
  },
  {
    name: "KrTheme",
    label: "KrTheme",
    value: "dark:krtheme",
    loader: () => import("./themes/krtheme.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A09",
      divider: "#0B0A09",
    },
  },
  {
    name: "Lazy.Inkdeep",
    label: "Lazy.Inkdeep",
    value: "light:lazy.inkdeep",
    loader: () => import("./themes/lazy.inkdeep.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Lazy",
    label: "Lazy",
    value: "light:lazy",
    loader: () => import("./themes/lazy.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Lowlight",
    label: "Lowlight",
    value: "dark:lowlight",
    loader: () => import("./themes/lowlight.tmTheme.json"),
    gutterSettings: {
      background: "#1E1E1E",
      divider: "#1E1E1E",
    },
  },
  {
    name: "Mac Classic",
    label: "Mac Classic",
    value: "light:mac-classic",
    loader: () => import("./themes/mac-classic.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Made of Code",
    label: "Made of Code",
    value: "light:made-of-code",
    loader: () => import("./themes/made-of-code.tmTheme.json"),
    gutterSettings: {
      background: "#090A1BF2",
      divider: "#090A1BF2",
    },
  },
  {
    name: "MagicWB Amiga",
    label: "MagicWB Amiga",
    value: "light:magicwb-amiga",
    loader: () => import("./themes/magicwb-amiga.tmTheme.json"),
    gutterSettings: {
      background: "#969696",
      divider: "#969696",
    },
  },
  {
    name: "Material Theme Lighter",
    label: "Material Theme Lighter",
    value: "light:material-theme-lighter",
    loader: () => import("./themes/material-theme-lighter.tmTheme.json"),
    gutterSettings: {
      background: "#FAFAFA",
      divider: "#FAFAFA",
    },
  },
  {
    name: "Material Theme Palenight",
    label: "Material Theme Palenight",
    value: "dark:material-theme-palenight",
    loader: () => import("./themes/material-theme-palenight.tmTheme.json"),
    gutterSettings: {
      background: "#3B8070FF",
      divider: "#3B8070FF",
    },
  },
  {
    name: "Material Theme",
    label: "Material Theme",
    value: "dark:material-theme",
    loader: () => import("./themes/material-theme.tmTheme.json"),
    gutterSettings: {
      background: "#263238",
      divider: "#263238",
    },
  },
  {
    name: "Menage A Trois",
    label: "Menage A Trois",
    value: "light:menage-a-trois",
    loader: () => import("./themes/menage-a-trois.tmTheme.json"),
    gutterSettings: {
      background: "#0F1014",
      divider: "#0F1014",
    },
  },
  {
    name: "Merbivore Soft",
    label: "Merbivore Soft",
    value: "dark:merbivore-soft",
    loader: () => import("./themes/merbivore-soft.tmTheme.json"),
    gutterSettings: {
      background: "#1C1C1C",
      divider: "#1C1C1C",
    },
  },
  {
    name: "Merbivore",
    label: "Merbivore",
    value: "dark:merbivore",
    loader: () => import("./themes/merbivore.tmTheme.json"),
    gutterSettings: {
      background: "#161616",
      divider: "#161616",
    },
  },
  {
    name: "Midnight",
    label: "Midnight",
    value: "dark:midnight",
    loader: () => import("./themes/midnight.tmTheme.json"),
    gutterSettings: {
      background: "#0A001FE3",
      divider: "#0A001FE3",
    },
  },
  {
    name: "Minimal Theme",
    label: "Minimal Theme",
    value: "light:minimal-theme",
    loader: () => import("./themes/minimal-theme.tmTheme.json"),
    gutterSettings: {
      background: "#302D26",
      divider: "#302D26",
    },
  },
  {
    name: "Monoindustrial",
    label: "Monoindustrial",
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
    value: "dark:monokai-dark",
    loader: () => import("./themes/monokai-dark.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Monokai for Textmaters Custom 2",
    label: "Monokai for Textmaters Custom 2",
    value: "light:monokai-for-textmaters-custom-2",
    loader: () =>
      import("./themes/monokai-for-textmaters-custom-2.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai for Textmaters Custom",
    label: "Monokai for Textmaters Custom",
    value: "dark:monokai-for-textmaters-custom",
    loader: () => import("./themes/monokai-for-textmaters-custom.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai Mod 3",
    label: "Monokai Mod 3",
    value: "dark:monokai-mod-3",
    loader: () => import("./themes/monokai-mod-3.tmTheme.json"),
    gutterSettings: {
      background: "#1D1E19F2",
      divider: "#1D1E19F2",
    },
  },
  {
    name: "Monokai Mod 2",
    label: "Monokai Mod 2",
    value: "dark:monokai-mod-2",
    loader: () => import("./themes/monokai-mod-2.tmTheme.json"),
    gutterSettings: {
      background: "#272822",
      divider: "#272822",
    },
  },
  {
    name: "Monokai Mod",
    label: "Monokai Mod",
    value: "dark:monokai-mod",
    loader: () => import("./themes/monokai-mod.tmTheme.json"),
    gutterSettings: {
      background: "#1D1E19F2",
      divider: "#1D1E19F2",
    },
  },
  {
    name: "MultiMarkdown",
    label: "MultiMarkdown",
    value: "light:multimarkdown",
    loader: () => import("./themes/multimarkdown.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Notebook",
    label: "Notebook",
    value: "dark:notebook",
    loader: () => import("./themes/notebook.tmTheme.json"),
    gutterSettings: {
      background: "#BEB69D",
      divider: "#BEB69D",
    },
  },
  {
    name: "Notepad 2",
    label: "Notepad 2",
    value: "light:notepad-2",
    loader: () => import("./themes/notepad-2.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Oceanic",
    label: "Oceanic",
    value: "dark:oceanic",
    loader: () => import("./themes/oceanic.tmTheme.json"),
    gutterSettings: {
      background: "#1B2630",
      divider: "#1B2630",
    },
  },
  {
    name: "Offy",
    label: "Offy",
    value: "dark:offy",
    loader: () => import("./themes/offy.tmTheme.json"),
    gutterSettings: {
      background: "#00002ECC",
      divider: "#00002ECC",
    },
  },
  {
    name: "One-Dark",
    label: "One-Dark",
    value: "dark:one-dark",
    loader: () => import("./themes/one-dark.tmTheme.json"),
    gutterSettings: {
      background: "#282c34",
      divider: "#282c34",
    },
  },
  {
    name: "Pastels on Dark",
    label: "Pastels on Dark",
    value: "light:pastels-on-dark",
    loader: () => import("./themes/pastels-on-dark.tmTheme.json"),
    gutterSettings: {
      background: "#211E1E",
      divider: "#211E1E",
    },
  },
  {
    name: "Pastie",
    label: "Pastie",
    value: "light:pastie",
    loader: () => import("./themes/pastie.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Pengwynn Menlo",
    label: "Pengwynn Menlo",
    value: "dark:pengwynn-menlo",
    loader: () => import("./themes/pengwynn-menlo.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Pengwynn",
    label: "Pengwynn",
    value: "dark:pengwynn",
    loader: () => import("./themes/pengwynn.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Plum Dumb",
    label: "Plum Dumb",
    value: "light:plum-dumb",
    loader: () => import("./themes/plum-dumb.tmTheme.json"),
    gutterSettings: {
      background: "#00000BF7",
      divider: "#00000BF7",
    },
  },
  {
    name: "Putty",
    label: "Putty",
    value: "dark:putty",
    loader: () => import("./themes/putty.tmTheme.json"),
    gutterSettings: {
      background: "#242322",
      divider: "#242322",
    },
  },
  {
    name: "Rails Envy",
    label: "Rails Envy",
    value: "light:rails-envy",
    loader: () => import("./themes/rails-envy.tmTheme.json"),
    gutterSettings: {
      background: "#121210",
      divider: "#121210",
    },
  },
  {
    name: "Railscasts Boost",
    label: "Railscasts Boost",
    value: "dark:railscasts-boost",
    loader: () => import("./themes/railscasts-boost.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Railscasts",
    label: "Railscasts",
    value: "dark:railscasts",
    loader: () => import("./themes/railscasts.tmTheme.json"),
    gutterSettings: {
      background: "#2B2B2B",
      divider: "#2B2B2B",
    },
  },
  {
    name: "RDark",
    label: "RDark",
    value: "dark:rdark",
    loader: () => import("./themes/rdark.tmTheme.json"),
    gutterSettings: {
      background: "#1B2426",
      divider: "#1B2426",
    },
  },
  {
    name: "Resesif",
    label: "Resesif",
    value: "dark:resesif",
    loader: () => import("./themes/resesif.tmTheme.json"),
    gutterSettings: {
      background: "#2B2B2B",
      divider: "#2B2B2B",
    },
  },
  {
    name: "Ruby Blue",
    label: "Ruby Blue",
    value: "light:ruby-blue",
    loader: () => import("./themes/ruby-blue.tmTheme.json"),
    gutterSettings: {
      background: "#121E31",
      divider: "#121E31",
    },
  },
  {
    name: "RubyRobot",
    label: "RubyRobot",
    value: "dark:rubyrobot",
    loader: () => import("./themes/rubyrobot.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Ryan Light",
    label: "Ryan Light",
    value: "light:ryan-light",
    loader: () => import("./themes/ryan-light.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Sidewalk Chalk",
    label: "Sidewalk Chalk",
    value: "light:sidewalk-chalk",
    loader: () => import("./themes/sidewalkchalk.tmTheme.json"),
    gutterSettings: {
      background: "#2B2D2E",
      divider: "#2B2D2E",
    },
  },
  {
    name: "Sidewalk Chalk Green Mod",
    label: "Sidewalk Chalk Green Mod",
    value: "light:sidewalk-chalk-green-mod",
    loader: () => import("./themes/sidewalkchalkgreenmod.tmTheme.json"),
    gutterSettings: {
      background: "#2B2D2E",
      divider: "#2B2D2E",
    },
  },
  {
    name: "Smoothy",
    label: "Smoothy",
    value: "light:smoothy",
    loader: () => import("./themes/smoothy.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Solarized Dark",
    label: "Solarized Dark",
    value: "light:solarized-dark",
    loader: () => import("./themes/solarized-dark.tmTheme.json"),
    gutterSettings: {
      background: "#042029",
      divider: "#042029",
    },
  },
  {
    name: "Solarized Light",
    label: "Solarized Light",
    value: "light:solarized-light",
    loader: () => import("./themes/solarized-light.tmTheme.json"),
    gutterSettings: {
      background: "#FDF6E3",
      divider: "#FDF6E3",
    },
  },
  {
    name: "Solarized Sepia",
    label: "Solarized Sepia",
    value: "dark:solarized-sepia",
    loader: () => import("./themes/solarized-sepia.tmTheme.json"),
    gutterSettings: {
      background: "#FDF6E3",
      divider: "#FDF6E3",
    },
  },
  {
    name: "SpaceCadet",
    label: "SpaceCadet",
    value: "dark:spacecadet",
    loader: () => import("./themes/spacecadet.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Spectacular",
    label: "Spectacular",
    value: "dark:spectacular",
    loader: () => import("./themes/spectacular.tmTheme.json"),
    gutterSettings: {
      background: "#0B0A0A",
      divider: "#0B0A0A",
    },
  },
  {
    name: "Starlight",
    label: "Starlight",
    value: "dark:starlight",
    loader: () => import("./themes/starlight.tmTheme.json"),
    gutterSettings: {
      background: "#223859F2",
      divider: "#223859F2",
    },
  },
  {
    name: "Succulent",
    label: "Succulent",
    value: "dark:succulent",
    loader: () => import("./themes/succulent.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Summer Camp Daybreak",
    label: "Summer Camp Daybreak",
    value: "light:summer-camp-daybreak",
    loader: () => import("./themes/summer-camp-daybreak.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Summer Camp Mod",
    label: "Summer Camp Mod",
    value: "light:summer-camp-mod",
    loader: () => import("./themes/summer-camp-mod.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Summer Sun",
    label: "Summer Sun",
    value: "light:summer-sun",
    loader: () => import("./themes/summer-sun.tmTheme.json"),
    gutterSettings: {
      background: "#110F0A",
      divider: "#110F0A",
    },
  },
  {
    name: "Sunburst",
    label: "Sunburst",
    value: "dark:sunburst",
    loader: () => import("./themes/sunburst.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Sweyla Theme (650478)",
    label: "Sweyla Theme (650478)",
    value: "light:sweyla-theme-(650478)",
    loader: () => import("./themes/sweyla650478.tmTheme.json"),
    gutterSettings: {
      background: "#020306",
      divider: "#020306",
    },
  },
  {
    name: "Sweyla Theme (674314)",
    label: "Sweyla Theme (674314)",
    value: "light:sweyla-theme-(674314)",
    loader: () => import("./themes/sweyla674314.tmTheme.json"),
    gutterSettings: {
      background: "#0E0C00",
      divider: "#0E0C00",
    },
  },
  {
    name: "Swyphs II",
    label: "Swyphs II",
    value: "light:swyphs-ii",
    loader: () => import("./themes/swyphs-ii.tmTheme.json"),
    gutterSettings: {
      background: "#000000FA",
      divider: "#000000FA",
    },
  },
  {
    name: "Tango in Twilight",
    label: "Tango in Twilight",
    value: "light:tango-in-twilight",
    loader: () => import("./themes/tango-in-twilight.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Tango",
    label: "Tango",
    value: "light:tango",
    loader: () => import("./themes/tango.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Tek",
    label: "Tek",
    value: "dark:tek",
    loader: () => import("./themes/tek.tmTheme.json"),
    gutterSettings: {
      background: "#2F4F4F",
      divider: "#2F4F4F",
    },
  },
  {
    name: "Text Ex Machina (Lighter comments)",
    label: "Text Ex Machina (Lighter comments)",
    value: "light:text-ex-machina-(lighter-comments)",
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
    value: "light:text-ex-machina",
    loader: () => import("./themes/text-ex-machina.tmTheme.json"),
    gutterSettings: {
      background: "#151515",
      divider: "#151515",
    },
  },
  {
    name: "Tokyo Night",
    label: "Tokyo Night",
    value: "dark:tokyo-night",
    loader: () => import("./themes/tokyo-night.tmTheme.json"),
    gutterSettings: {
      background: "#1d1f29",
      divider: "#1d1f29",
    },
  },
  {
    name: "Tomorrow Night - Blue",
    label: "Tomorrow Night - Blue",
    value: "light:tomorrow-night---blue",
    loader: () => import("./themes/tomorrow-night-blue.tmTheme.json"),
    gutterSettings: {
      background: "#002451",
      divider: "#002451",
    },
  },
  {
    name: "Tomorrow Night - Bright",
    label: "Tomorrow Night - Bright",
    value: "light:tomorrow-night---bright",
    loader: () => import("./themes/tomorrow-night-bright.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Tomorrow Night - Eighties",
    label: "Tomorrow Night - Eighties",
    value: "light:tomorrow-night---eighties",
    loader: () => import("./themes/tomorrow-night-eighties.tmTheme.json"),
    gutterSettings: {
      background: "#2D2D2D",
      divider: "#2D2D2D",
    },
  },
  {
    name: "Tomorrow Night",
    label: "Tomorrow Night",
    value: "light:tomorrow-night",
    loader: () => import("./themes/tomorrow-night.tmTheme.json"),
    gutterSettings: {
      background: "#1D1F21",
      divider: "#1D1F21",
    },
  },
  {
    name: "Tomorrow Night 2",
    label: "Tomorrow Night 2",
    value: "light:tomorrow-night-2",
    loader: () => import("./themes/tomorrow-night2.tmTheme.json"),
    gutterSettings: {
      background: "#1D1F21",
      divider: "#1D1F21",
    },
  },
  {
    name: "Tomorrow",
    label: "Tomorrow",
    value: "light:tomorrow",
    loader: () => import("./themes/tomorrow.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Tubster",
    label: "Tubster",
    value: "dark:tubster",
    loader: () => import("./themes/tubster.tmTheme.json"),
    gutterSettings: {
      background: "#232323",
      divider: "#232323",
    },
  },
  {
    name: "Twilight Bright",
    label: "Twilight Bright",
    value: "dark:twilight-bright",
    loader: () => import("./themes/twilight-bright.tmTheme.json"),
    gutterSettings: {
      background: "#FFFFFF",
      divider: "#FFFFFF",
    },
  },
  {
    name: "Twilight Remix",
    label: "Twilight Remix",
    value: "dark:twilight-remix",
    loader: () => import("./themes/twilight-remix.tmTheme.json"),
    gutterSettings: {
      background: "#030303",
      divider: "#030303",
    },
  },
  {
    name: "Twilight",
    label: "Twilight",
    value: "dark:twilight",
    loader: () => import("./themes/twilight.tmTheme.json"),
    gutterSettings: {
      background: "#141414",
      divider: "#141414",
    },
  },
  {
    name: "Upstream Sunburst",
    label: "Upstream Sunburst",
    value: "dark:upstream-sunburst",
    loader: () => import("./themes/upstream-sunburst.tmTheme.json"),
    gutterSettings: {
      background: "#000000F7",
      divider: "#000000F7",
    },
  },
  {
    name: "Upstream Vibrant",
    label: "Upstream Vibrant",
    value: "light:upstream-vibrant",
    loader: () => import("./themes/upstream-vibrant.tmTheme.json"),
    gutterSettings: {
      background: "#000000D9",
      divider: "#000000D9",
    },
  },
  {
    name: "Venom",
    label: "Venom",
    value: "dark:venom",
    loader: () => import("./themes/venom.tmTheme.json"),
    gutterSettings: {
      background: "#0D0D0D",
      divider: "#0D0D0D",
    },
  },
  {
    name: "Vibrant Fin",
    label: "Vibrant Fin",
    value: "light:vibrant-fin",
    loader: () => import("./themes/vibrant-fin.tmTheme.json"),
    gutterSettings: {
      background: "#000000F2",
      divider: "#000000F2",
    },
  },
  {
    name: "Vibrant Ink choppedNscrewed",
    label: "Vibrant Ink choppedNscrewed",
    value: "light:vibrant-ink-choppednscrewed",
    loader: () => import("./themes/vibrant-ink-choppednscrewed.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Ink Remix",
    label: "Vibrant Ink Remix",
    value: "light:vibrant-ink-remix",
    loader: () => import("./themes/vibrant-ink-remix.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Ink",
    label: "Vibrant Ink",
    value: "light:vibrant-ink",
    loader: () => import("./themes/vibrant-ink.tmTheme.json"),
    gutterSettings: {
      background: "#000000",
      divider: "#000000",
    },
  },
  {
    name: "Vibrant Tango",
    label: "Vibrant Tango",
    value: "light:vibrant-tango",
    loader: () => import("./themes/vibrant-tango.tmTheme.json"),
    gutterSettings: {
      background: "#191D1E",
      divider: "#191D1E",
    },
  },
  {
    name: "Vintage Aurora",
    label: "Vintage Aurora",
    value: "light:vintage-aurora",
    loader: () => import("./themes/vintage-aurora.tmTheme.json"),
    gutterSettings: {
      background: "#2E0026DE",
      divider: "#2E0026DE",
    },
  },
  {
    name: "Whys Poignant",
    label: "Whys Poignant",
    value: "light:whys-poignant",
    loader: () => import("./themes/whys-poignant.tmTheme.json"),
    gutterSettings: {
      background: "#FFFEF9",
      divider: "#FFFEF9",
    },
  },
  {
    name: "Zachstronaut Theme 4.1",
    label: "Zachstronaut Theme 4.1",
    value: "light:zachstronaut-theme-4.1",
    loader: () => import("./themes/zachstronaut-theme-4.1.tmTheme.json"),
    gutterSettings: {
      background: "#181310FA",
      divider: "#181310FA",
    },
  },
  {
    name: "Zenburn",
    label: "Zenburn",
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
    value: "dark:zenburnesque",
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

