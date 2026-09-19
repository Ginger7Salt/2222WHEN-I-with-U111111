// src/apps/hub/gridLayout.js
//
// 编辑模式下 2D 自由拖拽要用到的网格几何计算：给定按顺序排列的
// items（每项带 colSpan），算出每一项落在第几行第几列。
//
// 这里的排布规则跟 paginateGridItems.js 里模拟的 CSS Grid 默认
// （sparse）自动排布完全一致——一整行放不下的宽卡会自动换到下一行，
// 那一行剩下的空位不会被后面的卡片回填。两个文件各自独立实现同一套
// 规则，是为了不去动 paginateGridItems.js 这个已经跑得很稳的分页
// 逻辑；这里只是多算一份「每项具体落在哪一格」，用于拖拽时的命中
// 判断，不参与实际分页展示。
//
// 编辑模式下应用区不再翻页，而是所有应用连续排成一个不分页、纵向
// 滚动的网格，所以这里不需要 rowsPerPage，只管无限往下排。

export const computeGridLayout = (items, columns = 2) => {
  let row = 0;
  let col = 0;

  return items.map((item) => {
    const span = Math.min(item.colSpan || 1, columns);

    if (col + span > columns) {
      row += 1;
      col = 0;
    }

    const placed = { ...item, row, col, span };

    col += span;
    if (col >= columns) {
      row += 1;
      col = 0;
    }

    return placed;
  });
};

// 把一个「像素落点」换算成网格的 (row, col)，用于拖拽时判断手指/
// 鼠标当前悬停在哪一格上。colWidth、rowHeight、gap 单位一致（px）即可。
export const pointToCell = ({
  x,
  y,
  columns = 2,
  colWidth,
  rowHeight,
  gap,
}) => {
  const col = Math.min(
    Math.max(Math.floor(x / (colWidth + gap)), 0),
    columns - 1
  );
  const row = Math.max(Math.floor(y / (rowHeight + gap)), 0);

  return { row, col };
};

// 给定「拖拽中的项被拿掉之后」的其余项，以及手指当前悬停的格子，
// 算出拖拽项应该插回数组的第几个位置——插在第一个「自己所在格子的
// 顺序编号 >= 目标格子顺序编号」的项前面；如果手指悬停位置比所有项
// 都靠后，就插到最后。
//
// 用「顺序编号」（row * columns + col）而不是直接比较 row/col，是
// 因为宽度为 2 的横幅卡固定从第 0 列开始，顺序编号能自然地把它排在
// 正确的位置上，不需要对 colSpan 做特殊分支。
export const findInsertionIndex = (layoutWithoutDragged, targetCell, columns = 2) => {
  const targetOrdinal = targetCell.row * columns + targetCell.col;

  const index = layoutWithoutDragged.findIndex(
    (entry) => entry.row * columns + entry.col >= targetOrdinal
  );

  return index === -1 ? layoutWithoutDragged.length : index;
};

export default computeGridLayout;