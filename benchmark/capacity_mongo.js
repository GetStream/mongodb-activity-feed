let steps = [
	{ start: 0, stop: 50, followers: 5 },
	{ start: 50, stop: 60, followers: 100 },
	{ start: 60, stop: 70, followers: 1000 },
	{ start: 70, stop: 80, followers: 2000 },
	{ start: 80, stop: 100, followers: 10000 },
]

let follows = []
for (const step of steps) {
	for (let x = step.start; x < step.stop; x++) {
		let target = await fm.getOrCreateFeed('user', x)
		for (let i = 0; i < step.followers; i++) {
			let source = await fm.getOrCreateFeed('timeline', `${x}-${i}`)
			follows.push({ source, target })
		}
	}
}

let userFeeds = {}
for (let x = 0; x < 100; x++) {
    let feed = await fm.getOrCreateFeed('user', x)
}

let promises = []
for (let feed of Object.values(userFeeds)) {
    promises.push(fm.addActivity(activity, feed))
}
await Promise.all(promises)
