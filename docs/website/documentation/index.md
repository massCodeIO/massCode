# Layout

massCode uses a space-based layout.

The application has a narrow space rail on the left for switching between the main work areas:

- Code
- Tools
- Math

In the Code space, the interface uses a three-column layout:

- the first column shows the library and folders
- the second column shows snippets from the selected location
- the third column contains the editor

Other spaces use layouts optimized for their own tasks, but keep the same overall navigation model through the space rail.

<img :src="withBase('/preview.png')">

<script setup>
import { withBase } from 'vitepress'
</script>
