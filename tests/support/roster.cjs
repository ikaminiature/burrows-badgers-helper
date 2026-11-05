exports.enableRosterEditing = async (page) => {
  const button = page.getByRole("button", { name: "編集モード", exact: true });
  if (await button.count()) await button.click();
};
