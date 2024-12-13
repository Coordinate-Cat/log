const titles = [
	"calling-native-commands-with-tauri"
];

export const posts = await Promise.all(titles.map(title => import(`./post/${title}.md`)));
