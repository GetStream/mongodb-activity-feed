import {dropDBs} from '../../test/utils.js'


describe('Add Activity', () => {
	before(async () => {
		await dropDBs();
	});

	describe('Add Activity To Flat Feed', () => {
		it('should update the rss collection', async () => {
			console.log('a')
		});

		it('should update the podcast collection', async () => {
			console.log('b')
		});
	});
});
