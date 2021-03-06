const path = require('path');
const assert = require('chai').assert;
const feathers = require('@feathersjs/feathers');
const configuration = require('@feathersjs/configuration');
const services = require('../../src/services');

async function cleanDatabase(app) {
  await require('../../src/models/achievement.model.js')(app).remove({});
  await require('../../src/models/event.model.js')(app).remove({});
  await require('../../src/models/xp.model.js')(app).remove({});
}

describe('\'User\' service', () => {
  let app;
  const user_id = 'TestUser';

  beforeEach(async () => {
    app = feathers();

    app.set('rules', require('../../src/rule-parser')(path.join(__dirname, '..', 'config', 'user_config.yml')));
    app.configure(configuration());
    app.configure(require('../../src/mongoose.js'));
    await cleanDatabase(app);
    app.configure(services);
    app.service('user').setup(app);
  });

  it('registered the service', () => {
    const service = app.service('user');

    assert.ok(service, 'Registered the service');
  });

  it('returns a user\'s xp and achievements', async () => {
    await app.service('xp').create({
      name: 'XP',
      user_id: user_id,
      amount: 20
    });

    await app.service('achievements').create({
      name: 'TestAchievement',
      user_id: user_id,
      current_amount: 1,
      total_amount: 1
    });

    const result = await app.service('user').get(user_id);

    assert.deepEqual(result.user_id, user_id);
    assert.include(result.achievements[0], {name: 'TestAchievement'});
    assert.include(result.xp[0], {name: 'XP'});
    assert.include(result.xp[0], {amount: 20});
  });

  it('returns only the current amount of achievements', async () => {
    await app.service('achievements').create({
      name: 'TestAchievement',
      user_id: user_id,
      current_amount: 5,
      total_amount: 10
    });

    const result = await app.service('user').get(user_id);

    assert.deepEqual(result.user_id, user_id);
    assert.include(result.achievements[0], {amount: 5});
  });

  it('does not return achievements where current_amount equals 0', async () => {
    await app.service('achievements').create({
      name: 'TestAchievement',
      user_id: user_id,
      current_amount: 0,
      total_amount: 10
    });

    const result = await app.service('user').get(user_id);

    assert.deepEqual(result.user_id, user_id);
    assert.lengthOf(result.achievements, 0);
  });

  it('does not return hidden achievements', async () => {
    await app.service('achievements').create({
      name: 'HiddenAchievement',
      user_id: user_id,
      current_amount: 1,
      total_amount: 1
    });

    await app.service('achievements').create({
      name: 'TestAchievement',
      user_id: user_id,
      current_amount: 1,
      total_amount: 1
    });

    const result = await app.service('user').get(user_id);

    assert.deepEqual(result.user_id, user_id);
    assert.include(result.achievements[0], {name: 'TestAchievement'});
    assert.notInclude(result.achievements[0], {name: 'HiddenAchievement'});
  });


  it('returns the correct level when using manual levels', async () => {
    await app.service('xp').create({
      name: 'XP',
      user_id: user_id,
      amount: 300
    });

    const result = await app.service('user').get(user_id);
    assert.deepEqual(result.user_id, user_id);
    assert.deepEqual(result.level, 3);
  });

  it('returns the correct level when using linear levels', async () => {
    app.set('rules', require('../../src/rule-parser')(path.join(__dirname, '..', 'config', 'linear_level_config.yml')));

    await app.service('xp').create({
      name: 'XP',
      user_id: user_id,
      amount: 250
    });

    const result = await app.service('user').get(user_id);
    assert.deepEqual(result.user_id, user_id);
    assert.deepEqual(result.level, 3);
  });

  it('returns the correct level when using exponential levels', async () => {
    app.set('rules', require('../../src/rule-parser')(path.join(__dirname, '..', 'config', 'exponential_level_config.yml')));

    await app.service('xp').create({
      name: 'XP',
      user_id: user_id,
      amount: 650
    });

    let result = await app.service('user').get(user_id);
    assert.deepEqual(result.user_id, user_id);
    assert.deepEqual(result.level, 4);

    const other_user = 'OtherTestUser';
    await app.service('xp').create({
      name: 'XP',
      user_id: other_user,
      amount: 800
    });

    result = await app.service('user').get(other_user);
    assert.deepEqual(result.user_id, other_user);
    assert.deepEqual(result.level, 5);
  });

  it('throws the correct error when given an invalid type', async () => {
    app.set('rules', require('../../src/rule-parser')(path.join(__dirname, '..', 'config', 'invalid_level_config.yml')));

    await app.service('xp').create({
      name: 'XP',
      user_id: user_id,
      amount: 50
    });

    try {
      await app.service('user').get(user_id);
      assert.fail();
    } catch (error) {
      assert.deepEqual(error.message, 'Levels Type should be one of "manual", "linear" or "exponential"');
    }
  });
});
