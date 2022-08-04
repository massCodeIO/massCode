# [3.0.0-beta.1](https://github.com/massCodeIO/massCode/compare/v2.10.0...v3.0.0-beta.1) (2022-08-04)

### Breaking Changes
- Drop Ace editor
- Does not support syntax highlighting for AQL, C9 Search Results, FSL, Gobstones, Jack, JSSM, LogiQL, LuaPage, Lucene, Maze, MIXAL, MUSHCode, RDoc, Redshift, RHTML, RST, Space
- Remove Light: Crome, Light: Textmate, Light: Xcode themes


### Bug Fixes

* **snippets:** folder rename [#162](https://github.com/massCodeIO/massCode/issues/162) ([#169](https://github.com/massCodeIO/massCode/issues/169)) ([c5ddd23](https://github.com/massCodeIO/massCode/commit/c5ddd231c6baecda6df572dda4406d50cc803575))


### Features

* add codemirror & use `.tmLanguage` directly as grammar ([#186](https://github.com/massCodeIO/massCode/issues/186)) ([d81536c](https://github.com/massCodeIO/massCode/commit/d81536ca362c4905bab807d4cb5c7397ef85c681))
* **i18n:** add Chinese traditional locale ([#161](https://github.com/massCodeIO/massCode/issues/161)) ([8b00fcd](https://github.com/massCodeIO/massCode/commit/8b00fcd58eca6c42402a747f23ac57ee8be28927))
* **i18n:** add Spanish locale ([bd68311](https://github.com/massCodeIO/massCode/commit/bd6831123158a38166025a3683412a290ca74114))



# [2.10.0](https://github.com/massCodeIO/massCode/compare/v2.9.0...v2.10.0) (2022-07-21)


### Bug Fixes

* **editor:** fallback to monospace font [#149](https://github.com/massCodeIO/massCode/issues/149) ([3d9efcd](https://github.com/massCodeIO/massCode/commit/3d9efcdc6dd82d6ae598e160333c3fb116b87aa9))
* **editor:** height when opening code preview ([#131](https://github.com/massCodeIO/massCode/issues/131)) ([c8d8443](https://github.com/massCodeIO/massCode/commit/c8d84432d71873a5b64c66c9f1afc4043031a20d))


### Features

* add tooltips ([#159](https://github.com/massCodeIO/massCode/issues/159)) ([9c90e71](https://github.com/massCodeIO/massCode/commit/9c90e713e9e6aa4d3425f0c68be2ebfba0fd5965))
* **i18n:** add Simplified Chinese for i18n ([#154](https://github.com/massCodeIO/massCode/issues/154)) ([843b91d](https://github.com/massCodeIO/massCode/commit/843b91de41752face2e8a86ae23a0e8d5ad1f57a))
* **snippets:** add snippets showcase link ([e30a174](https://github.com/massCodeIO/massCode/commit/e30a17469bf7da14e3dfaac289fbc25254bd5432))
* support i18n, add russian local ([#152](https://github.com/massCodeIO/massCode/issues/152)) ([59da3d9](https://github.com/massCodeIO/massCode/commit/59da3d95ee28f637fc3314cfc28cf940f7e3ee18))



# [2.9.0](https://github.com/massCodeIO/massCode/compare/v2.8.1...v2.9.0) (2022-07-13)


### Features

* **snippets:** add html & css renderer to snippets preview ([#126](https://github.com/massCodeIO/massCode/issues/126)) ([21828e6](https://github.com/massCodeIO/massCode/commit/21828e63a142c13953495e3d8693fe946deabe50))



## [2.8.1](https://github.com/massCodeIO/massCode/compare/v2.8.0...v2.8.1) (2022-07-09)


### Bug Fixes

* **editor:** search highlighting ([0bdab6c](https://github.com/massCodeIO/massCode/commit/0bdab6ceda460074cb1781b9ded3958309f8750f))
* **snippets:** blinking system folder when click ([bc7cdfe](https://github.com/massCodeIO/massCode/commit/bc7cdfee4090e7e65f036b6ad3b2a00913937ad6))
* **snippets:** clear search field after click folder ([6360b5c](https://github.com/massCodeIO/massCode/commit/6360b5cab456881a67ccad0ab4da61d7b5ad4e4d))
* **snippets:** double get snippets when add new snippet ([c38af77](https://github.com/massCodeIO/massCode/commit/c38af77500dd147aa3ff83bfa492464589f5b748))
* **snippets:** search [#117](https://github.com/massCodeIO/massCode/issues/117) ([beb8591](https://github.com/massCodeIO/massCode/commit/beb8591003f45305a1f08455ff4e26e785135e27))



# [2.8.0](https://github.com/massCodeIO/massCode/compare/v2.7.1...v2.8.0) (2022-07-08)


### Bug Fixes

* **markdown:** proper bg color for code block depending on theme ([85eaa64](https://github.com/massCodeIO/massCode/commit/85eaa6475c7f167b26f83e04424781844caf85c7))
* **snippets:** update editor if fragments is changed [#113](https://github.com/massCodeIO/massCode/issues/113) ([8908af9](https://github.com/massCodeIO/massCode/commit/8908af9906611d4cd604fe869840748a0bd6ce8a))


### Features

* **snippets:** create screenshot of snippets ([#115](https://github.com/massCodeIO/massCode/issues/115)) ([024dfa5](https://github.com/massCodeIO/massCode/commit/024dfa5870d9e7dd36f533dcb06898e9bc50a641))



## [2.7.1](https://github.com/massCodeIO/massCode/compare/v2.7.0...v2.7.1) (2022-07-07)


### Bug Fixes

* **editor:** update value after format ([3a91111](https://github.com/massCodeIO/massCode/commit/3a911112d7dcebc0b0299ada6e1e5e550c899197))
* **markdown:** render task list ([#107](https://github.com/massCodeIO/massCode/issues/107)) ([4ee1970](https://github.com/massCodeIO/massCode/commit/4ee19704291e55ef66b5e617ed56afc7a732edd5))
* **snippets:** await fetch snippets by click on system folders ([4f2a203](https://github.com/massCodeIO/massCode/commit/4f2a203611130713e20f64f1f4a6605d552f3dfe))


### Performance Improvements

* **editor:** set value only if snippet id is changed ([#109](https://github.com/massCodeIO/massCode/issues/109)) ([56bd929](https://github.com/massCodeIO/massCode/commit/56bd9296deae1f37a0f467b596fc4b2be0d4021c))
* **snippets:** no need to fetch snippets after patch ([3a51e69](https://github.com/massCodeIO/massCode/commit/3a51e695ac61e268cc499acd71f61ad48a57f28d))



# [2.7.0](https://github.com/massCodeIO/massCode/compare/v2.6.1...v2.7.0) (2022-07-06)


### Bug Fixes

* **snippets:** fragmetns scroll [#92](https://github.com/massCodeIO/massCode/issues/92) ([#105](https://github.com/massCodeIO/massCode/issues/105)) ([35e57dd](https://github.com/massCodeIO/massCode/commit/35e57dd233bbc518b7124084b1e64104ab9879ed))
* **snippets:** update snippets list after add new ([#101](https://github.com/massCodeIO/massCode/issues/101)) ([55bb05d](https://github.com/massCodeIO/massCode/commit/55bb05dae55a559c8bd4519713eeab24fb690218))


### Features

* add mermaid diagram for markdown ([#104](https://github.com/massCodeIO/massCode/issues/104)) ([e578056](https://github.com/massCodeIO/massCode/commit/e57805675fe352f1e9a7618d40b0e725e6fee2ba))
* **db:** add migration from SnippetsLab >= v2.1 ([#98](https://github.com/massCodeIO/massCode/issues/98)) ([542870d](https://github.com/massCodeIO/massCode/commit/542870d621673308549fdde1937f336029524830))
* **main: menu:** add donate via PayPal ([86bf46a](https://github.com/massCodeIO/massCode/commit/86bf46af9ffcaaf64cfd964c145f555ccb40ee05))



## [2.6.1](https://github.com/massCodeIO/massCode/compare/v2.6.0...v2.6.1) (2022-05-06)


### Bug Fixes

* **ui:** button spacing ([41ade18](https://github.com/massCodeIO/massCode/commit/41ade1819235ca1690450734807208279ef99ec8))



# [2.6.0](https://github.com/massCodeIO/massCode/compare/v2.5.0...v2.6.0) (2022-05-06)


### Bug Fixes

* **snippets:** deselect after context menu action ([4fb7b95](https://github.com/massCodeIO/massCode/commit/4fb7b95c8c9cb410ba25923ea90a498943db9837))
* **snippets:** flickering lang selector via add new fragment ([3c59f26](https://github.com/massCodeIO/massCode/commit/3c59f26463f2863fd20ae43c018a0e69c97ccc2a))
* **snippets:** multiple add to favorites ([1776679](https://github.com/massCodeIO/massCode/commit/1776679c78bc1b4fec892dbac736d64e6aed3e9e))
* **snippets:** show placeholder for not selected snippet ([25b4494](https://github.com/massCodeIO/massCode/commit/25b449416e74f6c253fc701c08a62c7d4770afe7))


### Features

* **snippets:** add description ([#74](https://github.com/massCodeIO/massCode/issues/74)) ([7e78922](https://github.com/massCodeIO/massCode/commit/7e78922a0536858111ffbe5ee34d9f3c156d6154))
* **snippets:** add sort by `name`, `createdAt` & `updatedAt` ([#69](https://github.com/massCodeIO/massCode/issues/69)) ([3603fad](https://github.com/massCodeIO/massCode/commit/3603fad4691dd55c329c1ce11e9050abe96e1e4a))



# [2.5.0](https://github.com/massCodeIO/massCode/compare/v2.4.0...v2.5.0) (2022-04-29)


### Bug Fixes

* **main: menu:** add check for updates for other platforms ([94676b6](https://github.com/massCodeIO/massCode/commit/94676b65c1dca707fae18fc1119d79636d20b89a))


### Features

* **main: menu:** add check for updates ([702d0f5](https://github.com/massCodeIO/massCode/commit/702d0f550306f57b2964c9588a579d6f3bbaf7c5))
* **snippets:** more languages support for prettier ([#58](https://github.com/massCodeIO/massCode/issues/58)) ([658d3c0](https://github.com/massCodeIO/massCode/commit/658d3c0bf69a801e9f4ff3c6ebd7d1b3c1e91f02))



# [2.4.0](https://github.com/massCodeIO/massCode/compare/v2.3.0...v2.4.0) (2022-04-27)


### Features

* **api:** create snippets ([#56](https://github.com/massCodeIO/massCode/issues/56)) ([4abd6bd](https://github.com/massCodeIO/massCode/commit/4abd6bd53660c8b2750700139ba0fa4202532c35))
* **main: menu:** add VS Code extension link ([98c4720](https://github.com/massCodeIO/massCode/commit/98c4720a3bf40fe3031808ccbf22717f4ac87d15))



# [2.3.0](https://github.com/massCodeIO/massCode/compare/v2.2.0...v2.3.0) (2022-04-26)


### Bug Fixes

* **api:** don't mutate snippets table during embed folders ([f60d045](https://github.com/massCodeIO/massCode/commit/f60d04586b5b7890df7dbcf5f0c71aedd4a455b4))
* **main: db:** migrate after move storage ([5406083](https://github.com/massCodeIO/massCode/commit/54060831a8bd3d3a11f63b8cb044e2c777d28f8d))
* **main: db:** set empty `value` for content if `value` is `null` on migrate from v1 [#38](https://github.com/massCodeIO/massCode/issues/38) ([1874d1c](https://github.com/massCodeIO/massCode/commit/1874d1c3c925175a74f95527d6aafb3307b09ffe))
* **snippets:** remove selected by click for system folder ([ebd9f29](https://github.com/massCodeIO/massCode/commit/ebd9f29ae31db0f5e03cec76e79a072c4b36b127))


### Features

* **main: menu:** add raycast & alfred extensions links ([aab76b6](https://github.com/massCodeIO/massCode/commit/aab76b61ad7191a929e3c3861b1394811ad926da))
* **snippets:** allow add snippets to inbox ([#52](https://github.com/massCodeIO/massCode/issues/52)) ([5cf809a](https://github.com/massCodeIO/massCode/commit/5cf809aea45e20d3cab9152dcb986652583413b6))



# [2.2.0](https://github.com/massCodeIO/massCode/compare/v2.1.1...v2.2.0) (2022-04-19)


### Bug Fixes

* **search:** set selected folder & snippet after focus on editor after search ([069e296](https://github.com/massCodeIO/massCode/commit/069e296f0aa3792990b8a25a1cfd314c853946fa))
* **snippets:** persist scroll position by change view ([ba05384](https://github.com/massCodeIO/massCode/commit/ba05384c62eb39115bcc6c0fdd5d0f0a6a83b6c5))


### Features

* **editor:** add `highlightGutter` & `highlightLine` settings ([#45](https://github.com/massCodeIO/massCode/issues/45)) ([52f8455](https://github.com/massCodeIO/massCode/commit/52f845575b641b1eeaa3a2a893b72f362908c744))



## [2.1.1](https://github.com/massCodeIO/massCode/compare/v2.1.0...v2.1.1) (2022-04-18)


### Bug Fixes

* **editor:** disable multiple selection by edit snippet after search ([ec2c1eb](https://github.com/massCodeIO/massCode/commit/ec2c1eb39605a87f575b0e5e970232b7ef5078fa))
* **sidebar:** tag highlight, spell fix tabs -> tags ([#33](https://github.com/massCodeIO/massCode/issues/33)) ([9be3e13](https://github.com/massCodeIO/massCode/commit/9be3e13b1fad2c8a5d027d36f743d7f1bc4afd86))
* **snippets:** color text for ghost for multiple dragged snippets ([fc25202](https://github.com/massCodeIO/massCode/commit/fc25202059819f298e27e4506c0625756219c97d))



# [2.1.0](https://github.com/massCodeIO/massCode/compare/v2.0.1...v2.1.0) (2022-04-15)


### Bug Fixes

* **snippets:** disable markdown preview by select other fragment [#27](https://github.com/massCodeIO/massCode/issues/27) ([#31](https://github.com/massCodeIO/massCode/issues/31)) ([a7dfceb](https://github.com/massCodeIO/massCode/commit/a7dfcebd7d0721a7c28f412ced93d4bf8d4e6518))
* unsubscribe on unmount for emiiter events [#29](https://github.com/massCodeIO/massCode/issues/29) ([#32](https://github.com/massCodeIO/massCode/issues/32)) ([d1d0bc5](https://github.com/massCodeIO/massCode/commit/d1d0bc583801d8655a1736310b4baef9e4f58372))


### Features

* **main: db:** migrate from SnippetsLab ([#30](https://github.com/massCodeIO/massCode/issues/30)) ([1d48506](https://github.com/massCodeIO/massCode/commit/1d485067c5b6f476d92149905b437ae918a16963))



## [2.0.1](https://github.com/massCodeIO/massCode/compare/v2.0.0...v2.0.1) (2022-04-15)


### Bug Fixes

* **snippets:** system folder highlight ([4cfe131](https://github.com/massCodeIO/massCode/commit/4cfe131bc79f55b28b1929905adfd86a7ada6086))



# [2.0.0](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.6...v2.0.0) (2022-04-15)


### Bug Fixes

* **snippets:** sort by `updatedAt` ([f5f50e6](https://github.com/massCodeIO/massCode/commit/f5f50e6a68d5b309fabe77f402b370a6d4d22d43))


### Features

* **api:** add controller to get snippets with folder ([3a2f1fb](https://github.com/massCodeIO/massCode/commit/3a2f1fb0f1d224e943942ad02be851c97a62ef97))
* **main: menu:** add find menu ([e42349e](https://github.com/massCodeIO/massCode/commit/e42349e25f6cfdbb9b74d3f7815a3e7eabd2b39a))
* **snippets:** show time for today updated & full date for other snippets ([3724a5b](https://github.com/massCodeIO/massCode/commit/3724a5b459034bab90a3410c5e2d720394c33581))



# [2.0.0-beta.6](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.5...v2.0.0-beta.6) (2022-04-14)


### Features

* add  4 light & 4 dark app theme ([#26](https://github.com/massCodeIO/massCode/issues/26)) ([e9dff1e](https://github.com/massCodeIO/massCode/commit/e9dff1e7739f770d557dc8cea4fcfc2bd131d0cd))
* **folders:** add rename context menu ([#25](https://github.com/massCodeIO/massCode/issues/25)) ([654767b](https://github.com/massCodeIO/massCode/commit/654767b98dbf25390af892ac3eb1ba93f7cefee0))
* **snippets:** exit from edit mode by enter for fragment ([9e3e301](https://github.com/massCodeIO/massCode/commit/9e3e301006953bc81ac7fee9bb3c1920b1ec5d39))



# [2.0.0-beta.5](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.4...v2.0.0-beta.5) (2022-04-13)


### Bug Fixes

* **snippets:** cut off snippets name for Windows [#20](https://github.com/massCodeIO/massCode/issues/20) ([#24](https://github.com/massCodeIO/massCode/issues/24)) ([097d2cb](https://github.com/massCodeIO/massCode/commit/097d2cbf688fdfc7404d1e7d9e479bb70dd42ed0))
* **snippets:** open external link in markdown ([b5d3ee0](https://github.com/massCodeIO/massCode/commit/b5d3ee01cf7ad48dffb0255d10b652f98659867b))


### Features

* add prettier for snippets formatting ([#22](https://github.com/massCodeIO/massCode/issues/22)) ([14b0f86](https://github.com/massCodeIO/massCode/commit/14b0f86ab67ed7bea7277c424988f75e07a8ed91))
* resizable layout ([#19](https://github.com/massCodeIO/massCode/issues/19)) ([a1e41b3](https://github.com/massCodeIO/massCode/commit/a1e41b3ab567854eda7b9c636cb94c6e34614242))
* update main menu ([#21](https://github.com/massCodeIO/massCode/issues/21)) ([6d14e7d](https://github.com/massCodeIO/massCode/commit/6d14e7df657f4762a8e43f207e909ee3eaed33cf))



# [2.0.0-beta.4](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.3...v2.0.0-beta.4) (2022-04-12)


### Bug Fixes

* **editor:** undo/redo stack ([84096c4](https://github.com/massCodeIO/massCode/commit/84096c47bcf88b49229997d592f473f23812672e))
* **snippets:** sort in 'All snippets' ([ab799d5](https://github.com/massCodeIO/massCode/commit/ab799d5df478bed659d56cb6529c1dd589355c0f))


### Features

* add editor preferences ([#18](https://github.com/massCodeIO/massCode/issues/18)) ([d1fe23f](https://github.com/massCodeIO/massCode/commit/d1fe23fd510445426424bef85df2e3cf01c086e4))
* **snippets:** add markdown preview ([#15](https://github.com/massCodeIO/massCode/issues/15)) ([c208871](https://github.com/massCodeIO/massCode/commit/c2088712ffbc38c2ce2593ec50dbaeaa6291bd7a))



# [2.0.0-beta.3](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.2...v2.0.0-beta.3) (2022-04-11)


### Bug Fixes

* **main: db:** create app folder [#14](https://github.com/massCodeIO/massCode/issues/14) ([750637d](https://github.com/massCodeIO/massCode/commit/750637d068dae50dc10cc7308e9f5862754f0177))
* **snippets:** scroll to top ([2dbecaf](https://github.com/massCodeIO/massCode/commit/2dbecaff987d9376e62fab0e98aa9194ef01d2d3))



# [2.0.0-beta.2](https://github.com/massCodeIO/massCode/compare/v2.0.0-beta.1...v2.0.0-beta.2) (2022-04-10)


### Features

* support win ([#13](https://github.com/massCodeIO/massCode/issues/13)) ([edc114c](https://github.com/massCodeIO/massCode/commit/edc114cd4995913f039da0197c2560c5a99828f1))



# [2.0.0-beta.1](https://github.com/massCodeIO/massCode/compare/9fd7085f113be898b9bde3a78eca1eff56c7a391...v2.0.0-beta.1) (2022-04-09)


### Bug Fixes

* **build:** change main script, move files to `src` ([6eb1e8a](https://github.com/massCodeIO/massCode/commit/6eb1e8a788abb15ec32d4089868ee2f5b30c6b30))
* **build:** include renderer to build ([8ea99c5](https://github.com/massCodeIO/massCode/commit/8ea99c5f1206876786e2a9d046fbc59d7048a2a0))
* **editor:** init theme ([1de3afa](https://github.com/massCodeIO/massCode/commit/1de3afae2669c9bf3125281c7192f6dd40b82d06))
* **editor:** set lang during init ([34c340d](https://github.com/massCodeIO/massCode/commit/34c340d91df1e3a93632526108fd3dfc30f3fd50))
* **editor:** update height ([2f55391](https://github.com/massCodeIO/massCode/commit/2f5539138448c6b062be3afca041a8e65c18192f))
* in build need to push to main route ([4dc4974](https://github.com/massCodeIO/massCode/commit/4dc497434e5612e87f178ae3ec9875eb95fe121f))
* **ipc:** cancel delete snippet ([7c71b49](https://github.com/massCodeIO/massCode/commit/7c71b4924a0c876ab767fa398ce4557a4bb48e9a))
* **main: api:** path resolve ([07d7f8c](https://github.com/massCodeIO/massCode/commit/07d7f8cf24cfc4d2fca14c77e579e9a39cc21c31))
* **main: db:** remove from app store `selectedFolderId` & `selectedFolderIds` ([8e364f1](https://github.com/massCodeIO/massCode/commit/8e364f1ea8617f0fd705b9982e381a39a7fa722d))
* **main: ipc:** add typing ([07cfb74](https://github.com/massCodeIO/massCode/commit/07cfb7432ad67992e13a57cf42c243a923879b5f))
* **main: store:** set cwd to v2 to prevent conflict ([075b490](https://github.com/massCodeIO/massCode/commit/075b4907de48d5c97ff1ee2a9ba5414ebf60afb4))
* **main:** import config in build ([aa68762](https://github.com/massCodeIO/massCode/commit/aa6876221b7e83c81e28c9f9d460d756270df148))
* **main:** ipc listener for `restart` ([4ea5460](https://github.com/massCodeIO/massCode/commit/4ea5460675aeb8e6d9013fda3bc09b084d293c95))
* **main:** set storage & backup path in dev mode ([dd455cf](https://github.com/massCodeIO/massCode/commit/dd455cfe8b0137bc752039908facdc647ea04725))
* **router:** import all views at once ([7762315](https://github.com/massCodeIO/massCode/commit/7762315e512c3135c8d0f08b670c110c2f251c74))
* **snippets:** `currentContent` & `currentLanguage` getters ([4b6e4e4](https://github.com/massCodeIO/massCode/commit/4b6e4e4952c701f691ec4b284447bb6553e8cb28))
* **snippets:** add `folder` prop as optional ([e28c761](https://github.com/massCodeIO/massCode/commit/e28c7614f3a921665276ed0f8a920d028c6d03c6))
* **snippets:** add new snippet from list header ([686c982](https://github.com/massCodeIO/massCode/commit/686c9829c6188c67bcc832e4b786b2089c35af34))
* **snippets:** blur snippets after context menu ([c8b1c6a](https://github.com/massCodeIO/massCode/commit/c8b1c6a4be754bf3f1efade02599c03c65d1cb2e))
* **snippets:** check for `undefined` ([f2b6a2f](https://github.com/massCodeIO/massCode/commit/f2b6a2f13c4cf03c20b97dc207fe30ed276eee56))
* **snippets:** delete fragments ([453fc05](https://github.com/massCodeIO/massCode/commit/453fc053862bc5045bd4e9c9837cafaed16831ea))
* **snippets:** delete from electron store snippet id ([b5dcb73](https://github.com/massCodeIO/massCode/commit/b5dcb7345badebaecaa7f46da8154fa100d7ce58))
* **snippets:** filter by not deleted ([c1099e7](https://github.com/massCodeIO/massCode/commit/c1099e73070a191f0235de52ef7446f27ba82c34))
* **snippets:** focus snippet name by add new snippet ([e2e4ff3](https://github.com/massCodeIO/massCode/commit/e2e4ff3d0193945fbb2cf0b578498f98c92f6f4b))
* **snippets:** get all snippets after patch ([f6b0d76](https://github.com/massCodeIO/massCode/commit/f6b0d7659a828a982224334355605a88495c2061))
* **snippets:** set first selected ([24bc85c](https://github.com/massCodeIO/massCode/commit/24bc85c5a82f0cc725e177d24a8533f0d4b20594))
* **snippets:** unset `selectedIds` by `setSnippetsByAlias` ([7d76a6c](https://github.com/massCodeIO/massCode/commit/7d76a6c3ede566f9d872914f29989dc2d2537ead))
* **tags:** scroll ([b060225](https://github.com/massCodeIO/massCode/commit/b0602254a11e8e4df30948beeb0120dabfeb54bc))
* **ui: tree:** disable `hoveredNodeId` if is dragged tree node ([6eab5e6](https://github.com/massCodeIO/massCode/commit/6eab5e67feea2f8abd8d9a8fc0e04a255d26bec2))


### Features

* add analytics ([#12](https://github.com/massCodeIO/massCode/issues/12)) ([d73856c](https://github.com/massCodeIO/massCode/commit/d73856cc631616d465a1c185466a99b9dcbf7840))
* add custom scroll, restore snippet position during init ([#10](https://github.com/massCodeIO/massCode/issues/10)) ([889624f](https://github.com/massCodeIO/massCode/commit/889624fb2e2307dcf89896027c775eeb1a91b4ac))
* add db (basic) ([#1](https://github.com/massCodeIO/massCode/issues/1)) ([bccf129](https://github.com/massCodeIO/massCode/commit/bccf129b4a4c10d5df5f48684fd1e51818db41a2))
* add editor (base) ([9fd7085](https://github.com/massCodeIO/massCode/commit/9fd7085f113be898b9bde3a78eca1eff56c7a391))
* add folder component & retrieve folders from store ([9120886](https://github.com/massCodeIO/massCode/commit/91208869996ac254cbfe2e596d852c523a81d0fc))
* add folder tree ([#2](https://github.com/massCodeIO/massCode/issues/2)) ([ac025f0](https://github.com/massCodeIO/massCode/commit/ac025f031c4d1cf0c2bfe1253812de2dd827581a))
* add init app ([5e4de2a](https://github.com/massCodeIO/massCode/commit/5e4de2a84288d21b80d9cae6688a9b48a01b8e08))
* add search ([#9](https://github.com/massCodeIO/massCode/issues/9)) ([e8f4bce](https://github.com/massCodeIO/massCode/commit/e8f4bceec2c1eccc36496eea4beda8be75af4dbb))
* add sidebar (basic) ([118e83a](https://github.com/massCodeIO/massCode/commit/118e83a808c683d9b8e2795bb6426bf84b68823c))
* add snippet list (basic) ([5681c75](https://github.com/massCodeIO/massCode/commit/5681c754a4a9457f4dc41bf0696e65a1a2503c4a))
* add snippets header, fragments (basic) ([8ae34ee](https://github.com/massCodeIO/massCode/commit/8ae34ee0249646cdcc2d770959a8f6c3af63c47e))
* add storage preferences ([#11](https://github.com/massCodeIO/massCode/issues/11)) ([7756db5](https://github.com/massCodeIO/massCode/commit/7756db5cd65638bfffe12cf8df8d5af1e4ec7a38))
* add tags ([#8](https://github.com/massCodeIO/massCode/issues/8)) ([c84386c](https://github.com/massCodeIO/massCode/commit/c84386c997669220368064ddc71489c8d0c599e0))
* **api:** add snippets batch delete ([f27295a](https://github.com/massCodeIO/massCode/commit/f27295a795c8a2422ee8470674a5a3af2857af27))
* **composable:** add `useApi` ([b29cd11](https://github.com/massCodeIO/massCode/commit/b29cd11a133cbf218ac824f0c18ee9791b9e4e6e))
* **composable:** add emitter ([80f7fc5](https://github.com/massCodeIO/massCode/commit/80f7fc5bf124cdb63e27c1722611814f1cd875d9))
* drop .env & add `config.ts` ([1ad8639](https://github.com/massCodeIO/massCode/commit/1ad8639041111d39679f2d9d2d942dd9145ad800))
* **editor:** add old languages mapping ([bfd86ba](https://github.com/massCodeIO/massCode/commit/bfd86ba6a1553f4c92fe65860fa76ffab08d75d0))
* **editor:** disable all keybindings ([b75d987](https://github.com/massCodeIO/massCode/commit/b75d987bdf5c0aca21744339e4f969ae7f61b283))
* fetch multiple folders with snippets ([62d427d](https://github.com/massCodeIO/massCode/commit/62d427db4987929ed548d99697e57345ccd7bd29))
* **folders:** add alias ([7297274](https://github.com/massCodeIO/massCode/commit/729727414a6a483e7a3ccd76d52046a00609bde3))
* **folders:** add context menu for add new, delete ([9f921b2](https://github.com/massCodeIO/massCode/commit/9f921b2ea7780c9ef1a34448c2bf31398be89835))
* **main: api:** add middleware for POST, PATCH & PUT ([df26660](https://github.com/massCodeIO/massCode/commit/df266606c5e1716dd8fd2e85f1eaf763abdd7fd0))
* **main: components:** return instance of menu ([5b12cc7](https://github.com/massCodeIO/massCode/commit/5b12cc7dcb35bf246a6b506365f85637bcd39011))
* **main: db:** map old languages during migration ([9e91d5a](https://github.com/massCodeIO/massCode/commit/9e91d5a0f5ff7686f1aeb1c1b62b0b8e19583fca))
* **main: ipc:** add context menu for snippets ([24f33c2](https://github.com/massCodeIO/massCode/commit/24f33c2523690406a2c65fba2bafa297e06c4192))
* **main: ipc:** add restart app listener ([1b8ea86](https://github.com/massCodeIO/massCode/commit/1b8ea860bb5969fd62bed02526fce154f1572f6e))
* **main: ipc:** create notification ([8a66475](https://github.com/massCodeIO/massCode/commit/8a66475819e59dbb4133fc655f0d1e69d7c1bdb1))
* **main: store:** store selected folder & snippet id ([b0547e2](https://github.com/massCodeIO/massCode/commit/b0547e23d7a6b085c27aac5a82ea18a8404af56d))
* **main:** add `createPopupMenu` constructor ([cc806ba](https://github.com/massCodeIO/massCode/commit/cc806ba003f16c8d35799f18cf6c66003fcfb4ff))
* **main:** add context menu ipc, typing ([d5c11ee](https://github.com/massCodeIO/massCode/commit/d5c11ee8f23e36d98588706592b3c7fd0bc235a1))
* **main:** check for update ([09ec5ee](https://github.com/massCodeIO/massCode/commit/09ec5eed378658bc6ec59c90b61d48b771d3fdb1))
* **main:** disable `webSecurity` ([3bd9999](https://github.com/massCodeIO/massCode/commit/3bd9999bfb276fc30a732b7ff60f297e0fbbc210))
* **main:** expose `on` & `once` events ([008e11a](https://github.com/massCodeIO/massCode/commit/008e11aa2ea8c010003182f7e6cc51eebd05000c))
* **main:** expose only `invoke` ipc ([daf42b5](https://github.com/massCodeIO/massCode/commit/daf42b5b134edd479bd93db0d669b260783ac832))
* **main:** extend exposed store methods ([e24ee88](https://github.com/massCodeIO/massCode/commit/e24ee88da68a3cc74cee9875855a9eeba8751cf3))
* **main:** provide preferences ([9520dc9](https://github.com/massCodeIO/massCode/commit/9520dc9523267eecfc3440f5ca99fe432534bc3c))
* **main:** provide store to renderer ([9829f0a](https://github.com/massCodeIO/massCode/commit/9829f0ad56b8b1a2a033961b67aee0e215bbe922))
* **main:** remove trash as folder from default ([34c8287](https://github.com/massCodeIO/massCode/commit/34c8287bc2da2319e9363431862851f8b9fcb766))
* **main:** set window width to 1000 ([a89367b](https://github.com/massCodeIO/massCode/commit/a89367b988fecb8592d5efc52fddf40a38317b96))
* **main:** store window bounds on move & resize ([3d1e88d](https://github.com/massCodeIO/massCode/commit/3d1e88d486c094c921a76cdd165af82b8b46e540))
* **sidebar:** add focus, selected state ([bc7f2d3](https://github.com/massCodeIO/massCode/commit/bc7f2d34f89e9b8ccc31bd852b5d487fa36b5429))
* **snippets:** add copy to clipboard ([1699335](https://github.com/massCodeIO/massCode/commit/169933530ca173c08b85d404e90d161edaa3a9bd))
* **snippets:** add date format, name placeholder ([da12895](https://github.com/massCodeIO/massCode/commit/da128951251d8514e4ad276779e9c043aedf2628))
* **snippets:** add delete fragment ([40c54fb](https://github.com/massCodeIO/massCode/commit/40c54fb14563be3b82d2fd95e8cec1626b887277))
* **snippets:** add delete method ([caad594](https://github.com/massCodeIO/massCode/commit/caad594b2b0f17117d94f44fbe98ff11dc7fe546))
* **snippets:** add delete, duplicate & add to favorites ([bc306fe](https://github.com/massCodeIO/massCode/commit/bc306fece419dbc0e1b2e7034a35648b05136052))
* **snippets:** add ediable snippet name, focus name for new snippet ([2798fa0](https://github.com/massCodeIO/massCode/commit/2798fa0b0ad6c1c84ea214355162175254b1cf91))
* **snippets:** add empty trash ([8bcf972](https://github.com/massCodeIO/massCode/commit/8bcf97297f02a5e2e24182aa94849f1380e689b9))
* **snippets:** add fragment coun ([6fdf620](https://github.com/massCodeIO/massCode/commit/6fdf62095083d6597a77a11629f0348a70c2ca4a))
* **snippets:** add h-scroll for fragments ([8ec47a6](https://github.com/massCodeIO/massCode/commit/8ec47a631f1a3021db72157ead99e9b28f3f399f))
* **snippets:** add multiple selection ([#6](https://github.com/massCodeIO/massCode/issues/6)) ([dcd0ff4](https://github.com/massCodeIO/massCode/commit/dcd0ff4a9483a89fb04e46facf8d4703c709e200))
* **snippets:** add new fragment ([fa1e828](https://github.com/massCodeIO/massCode/commit/fa1e828df9018f52181bc1ba95861762241089b7))
* **snippets:** add new snippet action ([60f35d7](https://github.com/massCodeIO/massCode/commit/60f35d733be3257722b2410e88d424d2a78d8258))
* **snippets:** add new snippet method ([412b3a1](https://github.com/massCodeIO/massCode/commit/412b3a14d7d0c5e6375f9e3212878cd13c4d5057))
* **snippets:** add patch method ([41ba0c8](https://github.com/massCodeIO/massCode/commit/41ba0c8c55e55cc45e832c09701fccf188c31934))
* **snippets:** add placeholder for not selected ([445431f](https://github.com/massCodeIO/massCode/commit/445431fdc3d63bdd086912e2e402a7674f20795b))
* **snippets:** add separeate context menu & actions ([2dc81b5](https://github.com/massCodeIO/massCode/commit/2dc81b5b633340b875a1dcc72f65cb715c05cec2))
* **snippets:** add snippets to folder by drag & drop ([a27b042](https://github.com/massCodeIO/massCode/commit/a27b04246625646aee2dfea224fda19a0c555d1b))
* **snippets:** editable fragment name ([8df0ea3](https://github.com/massCodeIO/massCode/commit/8df0ea368c5bbf5bcef9f418408ce842e6114203))
* **snippets:** get all snipptes, set snippets by folder id or alias ([313301c](https://github.com/massCodeIO/massCode/commit/313301c4fa1e7c2078f61d9b41454f6df4519a63))
* **snippets:** listen `context-menu:close` to remove highlight ([3fce6b5](https://github.com/massCodeIO/massCode/commit/3fce6b5ab4b5522c9f80b3a23f1ee166070c5987))
* **snippets:** retrieve snippets from store, update style ([88e7546](https://github.com/massCodeIO/massCode/commit/88e75462ce61885430094f81397a50a7c43b271a))
* **snippets:** select new fragment after add ([04c51af](https://github.com/massCodeIO/massCode/commit/04c51af36984f7d8c63e769c57c5e9f3d1d09e96))
* **snippets:** show only non deleted snippets ([f895d97](https://github.com/massCodeIO/massCode/commit/f895d9741cb653619e55daee3073aedb6cbe106c))
* **snippets:** sort by date ([dea7dc2](https://github.com/massCodeIO/massCode/commit/dea7dc27af6e2b8a3b3b21a60b1eeb47725e9905))
* **snippets:** use debounce for update content ([6d56cb5](https://github.com/massCodeIO/massCode/commit/6d56cb5643d4515acfd43f78521bae8d32060046))
* **store:** add app store, set app theme ([a48d439](https://github.com/massCodeIO/massCode/commit/a48d439932576d20df78fda3f117e6c022a791e1))
* **store:** add snippets & folders store (basic) ([18462a4](https://github.com/massCodeIO/massCode/commit/18462a48212e188767c8b19bbb8b040754cb08e1))
* **ui: tree:** add & expose`hoveredNodeId` ([59d7886](https://github.com/massCodeIO/massCode/commit/59d7886025a6c12b41eb96f6dc45994903fc0b02))
* **ui:** add `AppActionButton` ([20e739e](https://github.com/massCodeIO/massCode/commit/20e739e358c160c8934010c4ae3a8ebcf00efd20))
* **ui:** add `contextMenuHandler` for AppTree ([f8ded2a](https://github.com/massCodeIO/massCode/commit/f8ded2a680418b50c747ac74e3ba775242786ca7))
* update db table by API request, remove manual restart server ([cdbec6f](https://github.com/massCodeIO/massCode/commit/cdbec6f30719da5a4b712a1b2322083ed33814e2))
* update init ([cb3507d](https://github.com/massCodeIO/massCode/commit/cb3507db680dfc0df3b02afd11cd02dac083a5fe))



