module.exports = (sequelize, DataTypes) => {
  const ShiftPosition = sequelize.define('ShiftPosition', {
    id: { type: DataTypes.NUMERIC, allowNull: false, primaryKey: true },
    payment_amnt: { type: DataTypes.NUMERIC, allowNull: false },
    payment_type: { type: DataTypes.STRING, allowNull: false },
    filled: { type: DataTypes.BOOLEAN, defaultValue: false },
  });

  ShiftPosition.associate = (models) => {
    ShiftPosition.belongsTo(models.Shift);
    ShiftPosition.belongsTo(models.Position);
    // ShiftPosition.hasOne(models.InviteApply);
  };
  return ShiftPosition;
};
