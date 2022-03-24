/**
 * Конвертация вложенного строения дерева с 'children' в плоское
 * @param {Array} items - массив элементов
 * @param {String} link - связь по полю
 * @returns {Array} - плоский массив со связями по полю 'parentId'
 */
export function nestedToFlat (items: any[], link = 'id') {
  const flatList: any[] = []

  function flat (items: any[]) {
    items.forEach((i, index) => {
      if (i.children && i.children.length) {
        const children: any[] = i.children.map((item: any, idx: number) => {
          return {
            ...item,
            index: idx,
            parentId: i[link]
          }
        })

        flatList.push(...children)

        if (!flatList.find(l => l[link] === i[link])) {
          flatList.push({
            ...i,
            index,
            parentId: null
          })
        }

        flat(i.children)
      } else {
        if (!flatList.find(l => l[link] === i[link])) {
          flatList.push({
            ...i,
            index,
            parentId: null
          })
        }
      }
    })
  }

  flat(items)

  return flatList.map(({ children, ...rest }) => rest)
}
