const serializeGig = (gig) => {
    const owner = gig.freelancer;
    const populated = owner && typeof owner === 'object' && owner.fullName !== undefined;

    let freelancer = owner;
    if (populated) {
        freelancer = { id: owner._id, fullName: owner.fullName};
    

    if (owner.email) {
        freelancer.email = owner.email;
    }
}

return {
    id: gig._id,
    title: gig.title,
    description: gig.description,
    price: gig.price,
    category: gig.category,
    isActive: gig.isActive,
    freelancer,
    createdAt: gig.createdAt,
    updatedAt: gig.updatedAt
    };
};

const buildPagination = (page, limit, total) => ({
    page, 
    limit, 
    total,
    pages: Math.max(1, Math.ceil(total / limit))
});

module.exports = { serializeGig, buildPagination};