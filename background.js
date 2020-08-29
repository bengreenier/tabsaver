/**
 * Get current window
 */
const getCurrentWindow = () => browser.windows.getCurrent();

/**
 * Get all the windows
 */
const getWindows = () => browser.windows.getAll({ windowTypes: ["normal"] });

/**
 * Get the tabs for a given window
 * @param {number} windowId the id of the window to find tabs for
 */
const getTabsForWindow = (windowId) => browser.tabs.query({ windowId });

/**
 * Get the tabs from a set of windows
 * @param {array of windows} windows the windows to get tabs from
 */
const getTabsForWindows = (windows) =>
  Promise.all(windows.map((w) => getTabsForWindow(w.id))).then((arrs) =>
    arrs.flat()
  );

/**
 * Ensure a bookmark folder exists (creating if needed)
 * @param {string} title folder title
 * @param {boolean} forceEmpty forces the bookmark tree to be emptied
 */
const ensureBookmarkFolder = (title, forceEmpty = false) =>
  browser.bookmarks
    .search({ title })
    .then((list) => {
      if (list.length > 0) {
        return list[0];
      } else {
        throw new Error("Empty results");
      }
    })
    .then((folder) => {
      if (forceEmpty) {
        return browser.bookmarks.removeTree(folder.id).then(() => {
          throw new Error(`recreate me in catch`);
        });
      } else {
        return folder;
      }
    })
    .catch(() => {
      return browser.bookmarks.create({
        title,
        type: "folder",
      });
    });

/**
 * Save tabs into a bookmark folder
 * @param {array of tabs} tabs the list of tabs to save
 * @param {number} parentId the id of the parent bookmark folder to save into
 */
const saveTabs = (tabs, parentId) =>
  Promise.all(
    tabs.map((t) =>
      browser.bookmarks.create({
        title: t.title,
        url: t.url,
        type: "bookmark",
        parentId,
      })
    )
  );

/**
 * When we idle, save the tabs to a daily "autosave" folder
 */
browser.idle.onStateChanged.addListener((state) => {
  if (state !== "active") {
    // save all  tabs
    getWindows()
      .then((windows) => getTabsForWindows(windows))
      .then((tabs) => {
        console.log(`[IDLE SAVE] ${new Date().toISOString()}: ${tabs.length}`);

        const title = `[tabsaver] autosave @ ${new Date().toLocaleDateString()}`;
        return ensureBookmarkFolder(title, true).then((folder) =>
          saveTabs(tabs, folder.id)
        );
      });
  }
});

// force save clicked
browser.browserAction.onClicked.addListener(() => {
  getCurrentWindow()
    .then((window) => getTabsForWindow(window.id))
    .then((tabs) => {
      console.log(`[FORCE SAVE] ${new Date().toISOString()}: ${tabs.length}`);

      const title = `[tabsaver] ${
        tabs.length
      } @ ${new Date().toLocaleString()}`;
      return ensureBookmarkFolder(title).then((folder) =>
        saveTabs(tabs, folder.id)
      );
    });
});
