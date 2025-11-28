#ifndef CORRELATIONADJUSTER_H_
#define CORRELATIONADJUSTER_H_

using namespace std;

#include <iostream>
#include <fstream>
#include <sstream>
#include <map>
#include <vector>
#include <cassert>
#include <iomanip>
#include <cmath>
#include <algorithm>

class CorrelationAdjuster {
public:
    CorrelationAdjuster(map<int, double>& input_ppr, vector<double>& node_to_l2_normalized_dc);
    CorrelationAdjuster() = delete;
    // void topk_initialize();
    double calc_influence_decreased_ppr(double cosine_similarity, map<int, double>& decreased_ppr) const;
    // double calc_influence_decreased_topk_ppr(double cosine_similarity, int k, vector<pair<int, double>>& topk_ppr) const;
    double get_projection_length() const {
        return projection_length;
    }

private:
    map<int, double>& ppr;
    vector<double>& node_to_l2_normalized_dc;
    double projection_length;
    bool is_topk_initialized = false;
    vector<pair<int, double>> ordered_ppr;
    double _l2_norm(const map<int, double>& m) const;
    vector<pair<int, double>> _get_ordered_map(const map<int, double>& m) const;
    void _sort_vector_pair(vector<pair<int, double>>& v) const;
};

#endif