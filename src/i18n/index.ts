import i18next from 'i18next';
import { moment } from 'obsidian';
import * as en from './locale/en.json';
import * as zh_cn from './locale/zh_cn.json';
i18next.init({
    lng: 'en', // if you're using a language detector, do not define the lng option
    fallbackLng: 'en',
    debug: true,
    resources: {
        en: {
            translation: en
        },
        zh_cn: {
            translation: zh_cn
        }
    }
});
const locale = moment.locale();
if (locale) {
    // zh-cn无法识别,改成下划线
    const lang = locale.replace('-', '_');
    i18next.changeLanguage(lang);
}
export const i18n = i18next;
