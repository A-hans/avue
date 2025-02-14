import { detailDataType, getAsVal } from 'utils/util';
import { validatenull } from 'utils/validate';
import { DIC_PROPS } from 'global/variable'
const key = 'key';
function getDataType (list = [], props = {}, type) {
  let valueKey = props.value || DIC_PROPS.value;
  let childrenKey = props.children || DIC_PROPS.children;
  list.forEach(ele => {
    ele[valueKey] = detailDataType(ele[valueKey], type);
    if (ele[childrenKey]) getDataType(ele[childrenKey], props, type);
  });
  return list;
};

function getResData (data, props, dataType) {
  const bind = props.bind || ''
  const list = bind.split('.');
  let res;
  if (list[0] === '') {
    let result = data.data
    if (result) {
      res = Array.isArray(result) ? result : [result]
    } else {
      res = data
    }
  }
  res = getAsVal(res, bind)
  if (dataType) res = getDataType(res, props, dataType)
  return res;
};
export const loadCascaderDic = (columnOption, safe) => {
  return new Promise(resolve => {
    let list = [];
    let result = {};
    let columnList = columnOption.filter(ele => ele.parentProp)
    safe.data.forEach((ele, index) => {
      if (!safe.cascaderDIC[index]) safe.$set(safe.cascaderDIC, index, {})
      columnList.forEach(column => {
        if (column.hide !== true && column.dicFlag !== false) {
          list.push(new Promise(resolve => {
            if (ele[column.parentProp]) {
              sendDic({
                url: column.dicUrl,
                props: column.props,
                method: column.dicMethod,
                headers: column.dicHeaders,
                formatter: column.dicFormatter,
                query: column.dicQuery,
                dataType: column.dataType,
                form: ele,
                value: ele[column.parentProp]
              }).then(res => {
                let obj = {
                  prop: column.prop,
                  data: res,
                  index: index
                }
                safe.$set(safe.cascaderDIC[index], obj.prop, obj.data)
                resolve(obj);
              });
            } else {
              let obj = {
                prop: column.prop,
                data: [],
                index: index
              }
              safe.$set(safe.cascaderDIC[index], obj.prop, obj.data)
              resolve(obj);
            }
          }));
        }
      });
    });
    Promise.all(list).then(data => {
      data.forEach(ele => {
        if (!result[ele.index]) result[ele.index] = {};
        result[ele.index][ele.prop] = ele.data;
      });
      resolve(result);
    });
  });
};
export const loadDic = (option, safe) => {
  return new Promise(resolve => {
    let list = [], result = {};
    let notList = [], nameList = [], column = option.column || [];
    column.forEach(ele => {
      let url = ele.dicUrl;
      let prop = ele.prop;
      let parentProp = ele.parentProp;
      notList = notList.concat(ele.cascader || []);
      let flag = ele.dicFlag === false || ele.lazy === true || notList.includes(prop);
      if (url && !parentProp && !flag) {
        list.push(new Promise(resolve => {
          sendDic({
            url: url,
            name: prop,
            method: ele.dicMethod,
            headers: ele.dicHeaders,
            formatter: ele.dicFormatter,
            props: ele.props,
            dataType: ele.dataType,
            query: ele.dicQuery
          }).then(res => {
            safe.$set(safe.DIC, prop, res);
            resolve(res)
          });
        }))
      }
    });
    Promise.all(list).then(res => {
      nameList.forEach((ele, index) => {
        result[ele] = res[index];
      });
      resolve(result);
    });
  });
};

export const loadLocalDic = (option, safe) => {
  let columnData = {};
  let optionData = option.dicData || {};
  option.column.forEach(ele => {
    if (ele.dicData) columnData[ele.prop] = getDataType(ele.dicData, ele.props, ele.dataType);
  });
  let result = { ...optionData, ...columnData }
  Object.keys(result).forEach(ele => {
    safe.$set(safe.DIC, ele, result[ele])
  })
  return result
};

export const sendDic = (params) => {
  let { url, query, method, props, formatter, headers, value, column = {}, form = {}, dataType } = params;
  url = column.dicUrl || url;
  method = (column.dicMethod || method || 'get').toLowerCase();
  headers = column.dicHeaders || headers || {}
  query = column.dicQuery || query || {};
  formatter = column.dicFormatter || formatter;
  props = column.props || props || {};
  let list = url.match(/[^\{\}]+(?=\})/g) || []
  list.forEach(ele => {
    let result = ele === key ? value : form[ele]
    if (validatenull(result)) result = ''
    url = url.replace(`{{${ele}}}`, result);
  });

  const getKey = (data) => {
    let result = {};
    Object.keys(data).forEach(ele => {
      let eleKey = data[ele];
      if (typeof (eleKey) == 'string' && eleKey.match(/\{{|}}/g)) {
        let prop = eleKey.replace(/\{{|}}/g, '');
        result[ele] = prop == key ? value : form[prop]
      } else {
        result[ele] = eleKey;
      }
      if (validatenull(result[ele])) result[ele] = ''
    });
    return result;
  }

  return new Promise(resolve => {
    if (!url) resolve([])
    const callback = (res) => {
      let list = [];
      res = res.data || {};
      if (typeof formatter === 'function') {
        list = formatter(res, form);
      } else {
        list = getResData(res, props, dataType);
      }
      resolve(list);
    };
    const getData = () => {
      let data = getKey(query);
      if (method == 'get') return { params: data }
      return { data }
    }
    window.axios(Object.assign({
      url,
      method,
      headers: getKey(headers),
    }, getData())).then(function (res) {
      callback(res);
    }).catch(() => [
      resolve([])
    ]);
  });
};
