// src/apps/hub/paginateGridItems.js
//
// 把大小不一的「拼图块」（每块只占 colSpan 列，行高统一为 1 行）按顺序
// 模拟真实的网格自动排布（一行放不下就换行），分配到若干页里，并保证
// 每一页用到的行数不超过 rowsPerPage。这样不管每页具体拼了哪些卡片，
// 画布的行数都是固定的，翻页时高度不会跳动。
//
// 注意：这里直接模拟 CSS Grid 的默认（sparse）自动排布规则——一个宽度
// 为 2 列的卡片如果排到某一行只剩 1 列时会自动换到下一行，那一行剩下的
// 空位就会空着，不会被后面的卡片回填。这和最终渲染用的 CSS Grid 行为
// 完全一致，所以不会出现「算出来没超页，实际渲染却多出一行」的情况。

export const buildPages = (
  items,
  { columns = 2, rowsPerPage = 4 } = {}
) => {
  const pages = [];
  let currentPage = [];
  let row = 0;
  let col = 0;

  const flushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    currentPage = [];
    row = 0;
    col = 0;
  };

  items.forEach((item) => {
    const span = Math.min(item.colSpan || 1, columns);

    // 当前行剩余的列数放不下这一块，换到下一行
    if (col + span > columns) {
      row += 1;
      col = 0;
    }

    // 换行之后这一页的行数已经用满，另开一页
    if (row >= rowsPerPage) {
      flushPage();
    }

    currentPage.push(item);
    col += span;

    if (col >= columns) {
      row += 1;
      col = 0;
    }
  });

  flushPage();

  return pages;
};

export default buildPages;