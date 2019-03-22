module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define('Shift', {
    name: { type: DataTypes.STRING, allowNull: false },
    time_date: { type: DataTypes.DATE, allowNull: false },
    duration: { type: DataTypes.NUMERIC, allowNull: false },
    lat: { type: DataTypes.NUMERIC, allowNull: false },
    long: { type: DataTypes.NUMERIC, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    payment_type: { type: DataTypes.STRING, allowNull: false },
    cache_rating: DataTypes.NUMERIC,
  });

  Shift.associate = (models) => {
    Shift.belongsTo(models.Maker);
    Shift.belongsToMany(models.Werker, {
      through: 'WerkerShift',
    });
    Shift.belongsToMany(models.PaymentType, {
      through: 'ShiftPaymentType',
    });
    Shift.belongsToMany(models.Position, {
      through: models.ShiftPosition,
      foreignKey: 'ShiftId',
    });
  };
  return Shift;
};
