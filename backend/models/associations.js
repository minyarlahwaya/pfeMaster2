const User = require("./UserModel");
const Pneu = require("./PneuModel");
const Marque = require("./MarqueModel");
const Vehicule = require("./VehiculeModel");
const VehiculePneu = require("./VehiculePneuModel");
const Commande = require("./Commande");
const CommandeItem = require("./CommandeItem");
const Promotion = require("./PromotionModel");
const Facture = require("./FactureModel");
const Avis = require("./AvisModel");
const Reclamation = require("./ReclamationModel");
const AvisLike = require("./AvisLikeModel");
const ReponseAvis = require("./ReponseAvisModel");



// ========================================
// Relation Marque - Pneu
// ========================================

Marque.hasMany(Pneu, {
    foreignKey: "marqueId",
    as: "pneus"
});

Pneu.belongsTo(Marque, {
    foreignKey: "marqueId",
    as: "marque"
});


// ========================================
// Relation Vehicule - Pneu
// ========================================

Vehicule.belongsToMany(Pneu, {
    through: VehiculePneu,
    foreignKey: "vehiculeId",
    otherKey: "pneuId",
    as: "pneus"
});

Pneu.belongsToMany(Vehicule, {
    through: VehiculePneu,
    foreignKey: "pneuId",
    otherKey: "vehiculeId",
    as: "vehicules"
});


// ========================================
// Relation User - Commande
// ========================================

User.hasMany(Commande, {
    foreignKey: "userId",
    as: "commandes"
});

Commande.belongsTo(User, {
    foreignKey: "userId",
    as: "user"
});


// ========================================
// Relation Commande - CommandeItem
// ========================================

Commande.hasMany(CommandeItem, {
    foreignKey: "commandeId",
    as: "items"
});

CommandeItem.belongsTo(Commande, {
    foreignKey: "commandeId",
    as: "commande"
});


// ========================================
// Relation Pneu - CommandeItem
// ========================================

Pneu.hasMany(CommandeItem, {
    foreignKey: "pneuId",
    as: "commandeItems"
});

CommandeItem.belongsTo(Pneu, {
    foreignKey: "pneuId",
    as: "pneu"
});






// ========================================
// Relation Pneu - Promotion
// ========================================

Pneu.hasMany(Promotion, {
    foreignKey: "pneuId",
    as: "promotions"
});

Promotion.belongsTo(Pneu, {
    foreignKey: "pneuId",
    as: "pneu"
});




// ========================================
// Relation Commande - Facture
// ========================================

Commande.hasOne(Facture, {
    foreignKey: "commandeId",
    as: "facture",
    onDelete: "CASCADE"
});

Facture.belongsTo(Commande, {
    foreignKey: "commandeId",
    as: "commande"
});




// Relation User - Avis//
User.hasMany(Avis, {
    foreignKey: "userId",
    as: "avis"
});

Avis.belongsTo(User, {
    foreignKey: "userId",
    as: "user"
});




// ========================================
// Relation Commande - Avis
// ========================================

// ========================================
// Relation Commande - Avis
// Une commande peut être associée à plusieurs avis
// ========================================

Commande.hasMany(Avis, {
    foreignKey: "commandeId",
    as: "avis"
});

Avis.belongsTo(Commande, {
    foreignKey: "commandeId",
    as: "commande"
});

Pneu.hasMany(Avis, {
    foreignKey: "pneuId",
    as: "avis"
});

Avis.belongsTo(Pneu, {
    foreignKey: "pneuId",
    as: "pneu"
});


// ========================================
// Relation User - Reclamation
// ========================================

User.hasMany(Reclamation, {
    foreignKey: "userId",
    as: "reclamations",
    onDelete: "CASCADE"
});

Reclamation.belongsTo(User, {
    foreignKey: "userId",
    as: "user"
});


 // ========================================
 // Relation Avis - Likes
 // ========================================

Avis.hasMany(AvisLike, {
    foreignKey: "avisId",
    as: "likes",
    onDelete: "CASCADE",
    hooks: true
});

AvisLike.belongsTo(Avis, {
    foreignKey: "avisId",
    as: "avis"
});

User.hasMany(AvisLike, {
    foreignKey: "userId",
    as: "avisLikes"
});

AvisLike.belongsTo(User, {
    foreignKey: "userId",
    as: "utilisateur"
});


// ========================================
// Relation Avis - Réponses
// ========================================

Avis.hasMany(ReponseAvis, {
    foreignKey: "avisId",
    as: "reponses",
    onDelete: "CASCADE",
    hooks: true
});

ReponseAvis.belongsTo(Avis, {
    foreignKey: "avisId",
    as: "avis"
});

User.hasMany(ReponseAvis, {
    foreignKey: "userId",
    as: "reponsesAvis"
});

ReponseAvis.belongsTo(User, {
    foreignKey: "userId",
    as: "auteur"
});

// ========================================
// Export
// ========================================

module.exports = {
    User,
    Pneu,
    Marque,
    Vehicule,
    VehiculePneu,
    Commande,
    CommandeItem,
      Promotion,
      Facture,
       Avis,
       AvisLike,
       ReponseAvis,
    Reclamation,

};


