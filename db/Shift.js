module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define('Shift', {
    name: { type: DataTypes.STRING, allowNull: false },
    start: { type: DataTypes.DATE, allowNull: false },
    end: { type: DataTypes.DATE, allowNull: false },
    lat: { type: DataTypes.NUMERIC, allowNull: false },
    long: { type: DataTypes.NUMERIC, allowNull: false },
    address: { type: DataTypes.STRING },
    description: { type: DataTypes.STRING, allowNull: false },
    cache_rating: DataTypes.NUMERIC,
  });

  Shift.associate = (models) => {
    Shift.belongsTo(models.Maker);
    Shift.belongsToMany(models.Werker, {
      through: 'WerkerShift',
    });
    Shift.belongsToMany(models.Position, {
      through: models.ShiftPosition,
      foreignKey: 'ShiftId',
    });
  };
  return Shift;
};
