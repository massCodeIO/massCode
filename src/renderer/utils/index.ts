/**
 * Конвертация плоского строения дерева во вложенный через 'children'
 * @param {Array} items - массив элементов c полями связей
 * с родительскими элементами
 * @param {String} id - ID элемента
 * @param {String} idLink - имя свойства ID
 * @param {String} link - имя связанного поля
 * @example [{id:1, parentId: null }, {id:2, parentId: 1 }] -> [{id:1, children: [id:2] }]
 */
export const flatToNested = (
  items: any[],
  id = null,
  idLink = 'id',
  link = 'parentId'
): any[] => {
  return items
    .filter(item => item[link] === id)
    .map(item => ({
      ...item,
      children: flatToNested(items, item[idLink])
    }))
}
