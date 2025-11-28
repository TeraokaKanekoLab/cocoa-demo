#include "CorrelationAdjuster.h"

CorrelationAdjuster::CorrelationAdjuster(map<int, double>& ppr, vector<double>& node_to_l2_normalized_dc) : ppr(ppr), node_to_l2_normalized_dc(node_to_l2_normalized_dc) {
    double ppr_l2_norm = _l2_norm(ppr);
    for (const auto&[node_id, ppr_val] : ppr) {
        ppr[node_id] = ppr_val / ppr_l2_norm;
    }

    projection_length = 0.0;
    for (auto const&[key, val] : ppr) {
        projection_length += val * node_to_l2_normalized_dc.at(key);
    }
    // cout << "projection_length : " << " " << projection_length << endl;
}

// void CorrelationAdjuster::topk_initialize() {
//     ordered_ppr = _get_ordered_map(ppr);
    
//     is_topk_initialized = true;
//     return;
// }

double CorrelationAdjuster::calc_influence_decreased_ppr(double cosine_similarity, map<int, double>& decreased_ppr) const {
    // double beta;
    double c = projection_length - cosine_similarity * sqrt((1 - pow(projection_length, 2)) / (1 - pow(cosine_similarity, 2)));
    // double diff = sqrt((pow(cosine_similarity,2) * (1 - pow(projection_length,2))) / ((1-pow(cosine_similarity,2))*pow(projection_length,2)));
    // if (cosine_similarity >= 0) beta = 1 - diff;
    // else beta = 1 + diff;
    // cout << "beta : " << beta << endl;

    // double coef = projection_length*beta;
    decreased_ppr = ppr;
    int n = node_to_l2_normalized_dc.size();
    for(int node_id = 0; node_id < n; node_id++) {
        decreased_ppr[node_id] -= node_to_l2_normalized_dc.at(node_id) * c;
    }
    return c;
}

// double CorrelationAdjuster::calc_influence_decreased_topk_ppr(double cosine_similarity, int k, vector<pair<int, double>>& topk_ppr) const {
//     assert(is_topk_initialized);
//     k = min(k, (int)ordered_ppr.size());

//     double beta;
//     double diff = sqrt((pow(cosine_similarity,2) * (1 - pow(projection_length,2))) / ((1-pow(cosine_similarity,2))*pow(projection_length,2)));
//     if (cosine_similarity >= 0) beta = 1 - diff;
//     else beta = 1 + diff;
//     // cout << "beta : " << beta << endl;

//     double coef = projection_length*beta;
//     int n = node_to_l2_normalized_dc.size();
//     if (coef > 0) {
//         double min_val = 1;
//         int rank_suf;
//         for (rank_suf = 0; rank_suf < k; rank_suf++) {
//             int node_id = ordered_ppr.at(rank_suf).first;
//             double ppr_val = ordered_ppr.at(rank_suf).second;
//             double decreased_ppr_val = ppr_val - node_to_l2_normalized_dc.at(node_id) * coef;
//             if (decreased_ppr_val < min_val) min_val = decreased_ppr_val;
//             topk_ppr.push_back(make_pair(node_id, decreased_ppr_val));
//         }
//         _sort_vector_pair(topk_ppr);

//         for (; rank_suf < ordered_ppr.size(); rank_suf++) {
//             int node_id = ordered_ppr.at(rank_suf).first;
//             double ppr_val = ordered_ppr.at(rank_suf).second;
//             if (ppr_val < min_val) break;

//             double decreased_ppr_val = ppr_val - node_to_l2_normalized_dc.at(node_id) * coef;
//             if (decreased_ppr_val > min_val) {
//                 // increase_ranking.push_back(make_pair(node_id, increase_val));
//                 for (int suf = topk_ppr.size()-1; suf > 0; suf--) {
//                     if (topk_ppr.at(suf-1).second < decreased_ppr_val) {
//                         topk_ppr[suf] = topk_ppr.at(suf-1);
//                     } else {
//                         topk_ppr[suf] = make_pair(node_id, decreased_ppr_val);
//                         break;
//                     }
//                 }
//                 min_val = topk_ppr.back().second;
//             }
//         }
//     } else {
//         for(int node_id = 0; node_id < n; node_id++) {
//             double ppr_val;
//             if (ppr.count(node_id) == 0) ppr_val = 0;
//             else ppr_val = ppr.at(node_id);
            
//             double decreased_ppr_val = ppr_val - node_to_l2_normalized_dc.at(node_id) * coef;
//             topk_ppr.push_back(make_pair(node_id, ppr_val));
//         }
//     }
//     _sort_vector_pair(topk_ppr);
//     topk_ppr.resize(k);
//     return beta;
// }

double CorrelationAdjuster::_l2_norm(const map<int, double>& m) const {
    double dot = 0.0;
    for (auto const&[key, val] : m) {
        dot += val * val;
    }
    return sqrt(dot);
}

vector<pair<int, double>> CorrelationAdjuster::_get_ordered_map(const map<int, double>& m) const {
    vector<pair<int, double>> m_vec;
    for(auto itr = m.begin(); itr != m.end(); ++itr) {
        m_vec.push_back({itr->first, itr->second});
    }
    _sort_vector_pair(m_vec);

    return m_vec;
}

void CorrelationAdjuster::_sort_vector_pair(vector<pair<int, double>>& v) const {
    sort(v.begin(), v.end(), 
    [](const pair<int, double> &l, const pair<int, double> &r) {
        if (l.second != r.second) return l.second > r.second;
        else return l.first < r.first;
    });
}